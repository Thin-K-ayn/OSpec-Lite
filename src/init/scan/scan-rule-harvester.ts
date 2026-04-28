import * as path from "node:path";
import { DEFAULT_RULES } from "../../core/ospec-lite-schema";
import { RuleItem } from "../../core/ospec-lite-types";
import { FileRepo } from "../../fs/file-repo";
import {
  collectBulletLines,
  parseHeading,
  stripManagedInstructionSections
} from "./scan-shared";

const RULE_SECTION_HEADINGS = new Set(["Hard Rules", "关键写作规则"]);
const DIRECTIVE_RULE_PATTERNS = [
  /\b(?:must|never|should|required|avoid)\b/i,
  /必须|不要|禁止|避免|应当|应该|不得|先读|先完成/
];
const MAX_HARVESTED_RULES = 6;

export class RuleHarvester {
  constructor(private readonly repo: FileRepo) {}

  async collectRules(rootDir: string): Promise<RuleItem[]> {
    const rules: RuleItem[] = DEFAULT_RULES.map((text, index) => ({
      id: `default-${index + 1}`,
      text,
      source: "default"
    }));
    const contents: string[] = [];

    for (const fileName of ["AGENTS.md", "CLAUDE.md"]) {
      const filePath = path.join(rootDir, fileName);
      if (!(await this.repo.exists(filePath))) {
        continue;
      }

      contents.push(stripManagedInstructionSections(await this.repo.readText(filePath)));
    }

    for (const text of this.collectHarvestedRuleTexts(contents)) {
      rules.push({
        id: `harvested-${rules.length + 1}`,
        text,
        source: "harvested"
      });
    }

    return this.uniqueRules(rules);
  }

  private collectHarvestedRuleTexts(contents: string[]): string[] {
    const sectionCandidates: string[] = [];
    const sectionKeys = new Set<string>();
    const fallbackCandidates: string[] = [];

    for (const content of contents) {
      for (const text of this.collectRuleSectionBullets(content)) {
        sectionCandidates.push(text);
        sectionKeys.add(this.toRuleKey(text));
      }
    }

    for (const content of contents) {
      for (const text of collectBulletLines(content)) {
        if (sectionKeys.has(this.toRuleKey(text))) {
          continue;
        }
        if (this.isDirectiveRule(text)) {
          fallbackCandidates.push(text);
        }
      }
    }

    return this.takeUniqueRules(sectionCandidates, fallbackCandidates);
  }

  private takeUniqueRules(...groups: string[][]): string[] {
    const harvested: string[] = [];
    const seen = new Set<string>();

    for (const group of groups) {
      for (const text of group) {
        const key = this.toRuleKey(text);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        harvested.push(text);
        if (harvested.length === MAX_HARVESTED_RULES) {
          return harvested;
        }
      }
    }

    return harvested;
  }

  private collectRuleSectionBullets(content: string): string[] {
    const bullets: string[] = [];

    for (const sectionBody of this.extractRuleSectionBodies(content)) {
      bullets.push(...collectBulletLines(sectionBody));
    }

    return bullets;
  }

  private extractRuleSectionBodies(content: string): string[] {
    const lines = content.split(/\r?\n/);
    const sections: string[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const heading = parseHeading(lines[index]);
      if (!heading || !RULE_SECTION_HEADINGS.has(heading.title)) {
        continue;
      }

      let endIndex = lines.length;
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const nextHeading = parseHeading(lines[cursor]);
        if (nextHeading && nextHeading.level <= heading.level) {
          endIndex = cursor;
          break;
        }
      }

      sections.push(lines.slice(index + 1, endIndex).join("\n"));
      index = endIndex - 1;
    }

    return sections;
  }

  private isDirectiveRule(text: string): boolean {
    return DIRECTIVE_RULE_PATTERNS.some((pattern) => pattern.test(text));
  }

  private toRuleKey(text: string): string {
    return text.toLowerCase();
  }

  private uniqueRules(rules: RuleItem[]): RuleItem[] {
    const seen = new Set<string>();
    const unique: RuleItem[] = [];

    for (const rule of rules) {
      const key = rule.text.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(rule);
    }

    return unique;
  }
}
