export declare function formatPrice(value: number): string;
export declare function formatDate(value: string | Date | null | undefined): string;
export declare function formatDateTime(value: string | Date | null | undefined): string;
/** "há 12 min", "há 3 h", "há 2 d" — usado na meta dos cards. */
export declare function timeAgo(value: string | Date | null | undefined): string;
export declare function slugify(input: string): string;
