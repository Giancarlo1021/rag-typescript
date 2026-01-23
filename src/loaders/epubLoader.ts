import EPub from "epub";
import { Chalk } from 'chalk';

const ctx = new Chalk({ level: 3 });

export class EpubLoader {
    async load(filePath: string): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const epub = new EPub(filePath);

            epub.on("error", (err) => reject(new Error(`EPUB Error: ${err.message}`)));

            epub.on("end", async () => {
                try {
                    // Use the spine if flow is empty
                    const manifest = epub.spine?.contents || [];

                    if (manifest.length === 0) {
                        return reject(new Error("EPUB structure is empty or unreadable."));
                    }

                    let fullContent: string[] = [];
                    let completed = 0;

                    manifest.forEach((chapter) => {
                        epub.getChapter(chapter.id, (err, text) => {
                            if (!err && text) {
                                // Strip HTML tags and clean up whitespace
                                const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                                fullContent.push(cleanText);
                            }

                            completed++;
                            if (completed === manifest.length) {
                                const finalResult = fullContent.join("\n\n");
                                console.log(ctx.green(`\n✅ Extracted ${finalResult.length} characters from ${filePath}`));

                                resolve([{
                                    pageContent: finalResult,
                                    metadata: { source: filePath.split('/').pop() }
                                }]);
                            }
                        });
                    });
                } catch (err) {
                    reject(err);
                }
            });

            epub.parse();
        });
    }
}