import { Controller, Get } from "@nestjs/common";

import { Public } from "../modules/auth/public.decorator.js";
import { bouwOpenApiDocument } from "./document.js";

// De OpenAPI-specificatie van deze API, publiek (API Design Rules: publiceer de OAS).
@Public()
@Controller()
export class OpenApiController {
  private document: Record<string, unknown> | null = null;

  @Get("openapi.json")
  specificatie(): Record<string, unknown> {
    this.document ??= bouwOpenApiDocument();
    return this.document;
  }
}
