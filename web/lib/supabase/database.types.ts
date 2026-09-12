// job_postings tablosu ve upsert_job_posting fonksiyonu için elle yazılmış minimal şema tipi.
// Kaynak: supabase/migrations/20260912120000_job_postings.sql
// Not: supabase-js'nin GenericSchema kısıtı için interface değil type alias kullanılır.
export type AcquisitionMethod = "manual" | "gmail";
export type UpsertOutcome = "inserted" | "updated" | "unchanged";

export type JobPostingRow = {
  id: string;
  owner_id: string;
  source: "linkedin" | "kariyer" | "indeed";
  source_job_id: string;
  url: string;
  title: string | null;
  company: string | null;
  location: string | null;
  description: string | null;
  first_seen_at: string;
  acquisition_method: AcquisitionMethod;
  source_email_id: string | null;
  created_at: string;
  updated_at: string;
};

export type JobPostingInsert = Omit<JobPostingRow, "id" | "owner_id" | "created_at" | "updated_at" | "first_seen_at"> &
  Partial<Pick<JobPostingRow, "id" | "owner_id" | "created_at" | "updated_at" | "first_seen_at">>;

export type UpsertJobPostingArgs = {
  p_source: JobPostingRow["source"];
  p_source_job_id: string;
  p_url: string;
  p_title?: string | null;
  p_company?: string | null;
  p_location?: string | null;
  p_description?: string | null;
  p_acquisition_method?: AcquisitionMethod;
  p_source_email_id?: string | null;
  p_first_seen_at?: string;
};

export type Database = {
  public: {
    Tables: {
      job_postings: {
        Row: JobPostingRow;
        Insert: JobPostingInsert;
        Update: Partial<JobPostingRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      upsert_job_posting: {
        Args: UpsertJobPostingArgs;
        Returns: UpsertOutcome;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
