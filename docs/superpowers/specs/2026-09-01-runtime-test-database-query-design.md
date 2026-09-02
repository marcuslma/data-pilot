# Consulta temporária a bancos de teste

**Status:** aprovado para planejamento

## Objetivo

Permitir que uma pessoa forneça, durante uma requisição HTTP, a conexão de um
banco de teste PostgreSQL ou MongoDB, descubra seu catálogo em tempo de
execução e execute uma consulta nativa de leitura. A aplicação não conhecerá
nem armazenará previamente o schema ou as credenciais dessas fontes.

Esta é a primeira etapa do Data Pilot. Ela valida a camada de acesso a dados
que, em uma etapa posterior, será chamada por um agente de IA.

## Escopo

Incluído nesta entrega:

- PostgreSQL e MongoDB como únicas fontes suportadas.
- Descoberta dinâmica de metadados por fonte.
- Execução de uma consulta nativa de leitura contra uma fonte por requisição.
- API HTTP disponível somente em ambiente de desenvolvimento ou teste.
- Testes unitários dos adaptadores e testes e2e dos contratos HTTP.

Fora de escopo:

- Persistência de fontes, catálogos ou credenciais.
- Autenticação de usuários e autorização por fonte.
- Consultas que combinem duas ou mais fontes.
- Escrita, DDL, migrações ou administração de bancos externos.
- Agente de IA, modelo de linguagem, embeddings ou Trino.

## Arquitetura

Um módulo `data-sources` define uma interface interna comum para adaptadores.
Cada adaptador é responsável apenas por validar a configuração recebida,
abrir e fechar a conexão, descobrir o catálogo e executar seu dialeto de
consulta.

```text
HTTP controller
      |
      +-- CatalogService / QueryService
                 |
                 +-- DataSourceAdapter
                       |-- PostgresAdapter
                       `-- MongoDbAdapter
```

Os serviços escolhem o adaptador pelo tipo da fonte. Eles não conhecem
detalhes de `pg` ou do driver `mongodb`. As conexões são criadas dentro da
operação e sempre encerradas em `finally`; nenhum objeto de conexão, URL ou
senha fica retido após a resposta.

## Contratos HTTP

### `POST /catalog`

Recebe uma fonte temporária:

```json
{
  "source": {
    "kind": "postgres",
    "connectionUrl": "postgresql://..."
  }
}
```

`kind` aceita `postgres` ou `mongodb`. A URL é validada contra o protocolo
correspondente antes da conexão.

A resposta normaliza somente metadados. Para PostgreSQL, inclui o banco
conectado, schemas, tabelas, colunas, tipos e chaves conhecidas. Para
MongoDB, inclui databases, coleções, índices e caminhos de campos com os
tipos observados em até 100 documentos amostrados por coleção. Valores dos
documentos amostrados não são devolvidos nem registrados em log.

### `POST /query`

Também recebe uma fonte temporária, mais uma consulta específica do banco:

```json
{
  "source": {
    "kind": "postgres",
    "connectionUrl": "postgresql://..."
  },
  "query": {
    "language": "sql",
    "text": "SELECT id, created_at FROM orders ORDER BY created_at DESC"
  }
}
```

Para MongoDB, `query` aceita uma operação `find` ou `aggregate`, uma coleção
e os objetos nativos necessários, como filtro, projeção, ordenação, limite
ou pipeline. Não existe endpoint que aceite JavaScript executável pelo banco.

As respostas de consulta trazem no máximo 1.000 linhas ou documentos e
metadados de execução, como tipo da fonte e quantidade de resultados. BSON é
serializado em Extended JSON para preservar tipos como `ObjectId` e datas.
As respostas não incluem a URL de conexão.

## Garantias de execução

O modo é deliberadamente livre quanto à linguagem de consulta, mas continua
sendo exclusivamente de leitura:

- PostgreSQL aceita uma única instrução SQL, rejeita múltiplas instruções e a
  executa em uma transação `READ ONLY`, com timeout de 10 segundos.
- MongoDB usa apenas chamadas do driver para `find` e `aggregate`; pipelines
  com `$out`, `$merge`, `$function`, `$accumulator` ou `$where` são rejeitados
  em qualquer nível do objeto de consulta.
- O endpoint de consulta trata uma fonte por vez. Assim, não há `JOIN`
  federado nem troca de dados entre conexões nesta etapa.
- As URLs de conexão e qualquer segredo nelas contido são removidos de erros
  e logs. Mensagens para o cliente explicam a categoria da falha sem repetir
  credenciais.
- A API recusa essas duas rotas quando `NODE_ENV` não for `development` ou
  `test`. A exposição em produção só será considerada junto de autenticação,
  autorização e armazenamento seguro de fontes.

Mesmo em teste, as fontes devem usar usuários próprios de leitura. A proteção
da aplicação reduz acidentes; as permissões do banco são a última barreira e
são necessárias para impedir mutações se uma funcionalidade nova vier a
contornar os bloqueios da API.

## Tratamento de erros

Entradas inválidas retornam `400`, tipos de fonte sem suporte retornam `400`,
e erros de conexão, autenticação do banco ou consulta inválida retornam uma
resposta `422` sem segredos. Tentativas de acesso às rotas fora dos ambientes
permitidos retornam `403`.

## Testes

Testes unitários cobrem a seleção de adaptador, normalização de catálogos,
encerramento de conexão em sucesso e falha, e bloqueios de escrita. Testes e2e
cobrem validação dos dois endpoints, formatos de erro e indisponibilidade em
produção simulada. Testes de integração com bancos reais são opcionais e só
rodam quando URLs de teste forem fornecidas pelo ambiente local; elas não são
incluídas no repositório.

## Evolução planejada

A próxima etapa transforma linguagem natural em uma consulta para essa mesma
camada. Depois disso, fontes poderão ser persistidas de forma cifrada e
consultas poderão envolver múltiplas fontes, possivelmente com Trino.
