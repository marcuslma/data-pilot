import { Type } from 'class-transformer';
import { IsDefined, IsObject, ValidateNested } from 'class-validator';
import { SourceDto } from './source.dto.js';

export class QueryRequestDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => SourceDto)
  source: SourceDto;

  @IsDefined()
  @IsObject()
  query: object;
}
