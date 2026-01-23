// Add the 'export' keyword right here!
export interface Document {
    content: string;
    metadata: {
        source: string;
        category?: string;
        [key: string]: any;
    };
}