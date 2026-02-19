import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cukohoqgvcsvmopvivjt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1a29ob3FndmNzdm1vcHZpdmp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzYzNzUsImV4cCI6MjA4NjkxMjM3NX0.pvM5kOgJcnzNqOXTQmPjXLaEyGfyaQjmH0DrL9t-2ww';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
