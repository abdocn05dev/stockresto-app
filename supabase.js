import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qjhbdgowrjolgtqpvjxt.supabase.co'
const supabaseKey = 'sb_publishable_cpj-HjglG0JGOw_Y466VDA_EiuSP6Er'

export const supabase = createClient(supabaseUrl, supabaseKey)