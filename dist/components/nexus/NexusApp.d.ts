export interface NexusAppProps {
    /** User ID from Astro server-side */
    userId: string;
    /** Email for display */
    userEmail: string;
    /** Supabase project URL (pass from import.meta.env.PUBLIC_SUPABASE_URL) */
    supabaseUrl?: string;
    /** Supabase anon key (pass from import.meta.env.PUBLIC_SUPABASE_ANON_KEY) */
    supabaseAnonKey?: string;
}
export declare function NexusApp({ userId, userEmail, supabaseUrl, supabaseAnonKey }: NexusAppProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=NexusApp.d.ts.map