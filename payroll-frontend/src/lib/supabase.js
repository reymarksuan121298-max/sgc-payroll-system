import { createClient } from '@supabase/supabase-js'

// Kunin mo ito sa Supabase Dashboard -> Project Settings -> API
const supabaseUrl = 'https://dqguqalmilgrfqrttvfq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZ3VxYWxtaWxncmZxcnR0dmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NjQ2NjIsImV4cCI6MjA3OTU0MDY2Mn0.bokzkm6sYdbT2SOWhvpcHmvzgoEAv_EnWvjJ-0Jw9yE'

export const supabase = createClient(supabaseUrl, supabaseKey)