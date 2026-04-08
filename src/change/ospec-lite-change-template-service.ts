import * as fs from "node:fs";
import * as path from "node:path";

export class ChangeTemplateService {
  private readonly templateCache = new Map<string, string>();

  constructor(
    private readonly templateRoot = path.join(__dirname, "templates")
  ) {}

  renderRequest(slug: string): string {
    return this.renderTemplate("request.md", { slug });
  }

  renderPlan(slug: string): string {
    return this.renderTemplate("plan.md", { slug });
  }

  renderApply(slug: string): string {
    return this.renderTemplate("apply.md", { slug });
  }

  renderVerify(slug: string): string {
    return this.renderTemplate("verify.md", { slug });
  }

  private renderTemplate(
    templateName: string,
    values: Record<string, string>
  ): string {
    const template = this.loadTemplate(templateName);
    return template.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_match, key: string) => {
      return values[key] ?? "";
    });
  }

  private loadTemplate(templateName: string): string {
    const cached = this.templateCache.get(templateName);
    if (cached) {
      return cached;
    }

    const templatePath = path.join(this.templateRoot, templateName);
    const template = fs.readFileSync(templatePath, "utf8");
    this.templateCache.set(templateName, template);
    return template;
  }
}
