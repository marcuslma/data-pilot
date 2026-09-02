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
import { AskRequestDto } from './dto/ask-request.dto.js';

@Controller()
@UseGuards(RuntimeAccessGuard)
export class AskController {
  constructor(private readonly askService: AskService) {}

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  ask(@Body() body: AskRequestDto) {
    return this.askService.ask(body);
  }
}
