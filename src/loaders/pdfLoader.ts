import * as fs from "fs/promises";
// @ts-ignore
import pdf from "pdf-parse/lib/pdf-parse.js";
import { Document } from "../types/document.js";
import path from "path";

export class PdfLoader {
  // category mapping
  private categoryMap: Record<string, string> = {
    "(DNA)": "thematic_dna",
    "(Core)": "rules",
  };

  private getCategory(filePath: string): string {
    const fileName = path.basename(filePath);

    for (const [keyword, category] of Object.entries(this.categoryMap)) {
      if (fileName.includes(keyword)) {
        return category;
      }
    }
    return "uncategorized";
  }

  async load(filePath: string): Promise<Document | null> {
    try {
      const dataBuffer = await fs.readFile(filePath);

      const data = await pdf(dataBuffer).catch((err) => {
        throw new Error(`PDF_PARSE_FAILED: ${err.message}`);
      });

      if (!data || !data.text) return null;

      return {
        content: data.text,
        metadata: {
          source: path.basename(filePath),
          category: "rpg-manual",
        },
      };
    } catch (error) {
      console.log(
        `\n⚠️ Skipping ${path.basename(filePath)}: PDF structure is too complex or corrupted.`,
      );
      return null;
    }
  }
}
