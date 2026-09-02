import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { SourceDto } from './source.dto.js';

export class CatalogRequestDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => SourceDto)
  source: SourceDto;
}
