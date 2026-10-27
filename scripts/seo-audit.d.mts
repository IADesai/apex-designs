export declare const PLACEHOLDER_MARKERS: string[];
export declare function auditPage(html: string, relPath: string): { title: string | undefined; errors: string[] };
export declare function auditSitemap(xml: string): string[];
export declare function findDuplicateTitles(pages: { path: string; title?: string }[]): string[];
