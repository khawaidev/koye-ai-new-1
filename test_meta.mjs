import { createClient } from '@supabase/supabase-js'

const url = 'https://vgtomykcrbvscepwmgft.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndG9teWtjcmJ2c2NlcHdtZ2Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NTgyNjAsImV4cCI6MjA3OTAzNDI2MH0.KY8aLOJa0Ofyo2RYOGxVKwy3E4zg3Dhf8jEd2zQg-UA'

async function test() {
  const supabase = createClient(url, key)
  const { data, error } = await supabase.from('project_file_metadata').select('*').limit(1)
  console.log(JSON.stringify(data, null, 2), error)
}
test()
