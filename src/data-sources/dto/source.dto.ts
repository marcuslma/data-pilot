import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import type { DataSourceKind } from '../data-source.types.js';

export class SourceDto {
  @IsIn(['postgres', 'mongodb'])
  kind: DataSourceKind;

  @IsString()
  @IsNotEmpty()
  connectionUrl: string;
}
