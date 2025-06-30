import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const SUPABASE_URL = 'https://gidpmhcpdrbctknrdzkso.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZHBtaGNwZHJiY3RrbnJkemtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyNDA1OTQsImV4cCI6MjA2NjgxNjU5NH0.RJgCnkhRmhMd66VEonb8u28i91lKZYLmLa32DdvTmkw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

