import { Test } from '@nestjs/testing';
import { ApiTokensController } from './api-tokens.controller';
import { ApiTokensService } from './api-tokens.service';
import type { TestingModule } from '@nestjs/testing';

describe('ApiTokensController', () => {
  let controller: ApiTokensController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiTokensController],
      providers: [ApiTokensService],
    }).compile();

    controller = module.get<ApiTokensController>(ApiTokensController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
