import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RuntimeAccessGuard } from '../data-sources/runtime-access.guard.js';
import { AskService } from './ask.service.js';
import {
  askRequestSchema,
  type AskRequest,
} from './ask.schemas.js';

@Controller()
@UseGuards(RuntimeAccessGuard)
export class AskController {
  constructor(private readonly askService: AskService) {}

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  ask(@Body({ schema: askRequestSchema }) body: AskRequest) {
    return this.askService.ask(body);
  }
}
