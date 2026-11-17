import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupDatabase() {
  console.log('[v0] Starting database setup...')

  try {
    // Step 1: Add header columns if they don't exist
    console.log('[v0] Adding header columns to custom_pages...')
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE custom_pages
        ADD COLUMN IF NOT EXISTS header1 TEXT,
        ADD COLUMN IF NOT EXISTS header2 TEXT,
        ADD COLUMN IF NOT EXISTS header3 TEXT;
      `,
    })

    if (alterError) {
      console.log('[v0] Note: Header columns may already exist or alteration skipped:', alterError.message)
    } else {
      console.log('[v0] Header columns added successfully')
    }

    // Step 2: Migrate About page to custom_pages if not already present
    console.log('[v0] Checking if about page exists in custom_pages...')
    const { data: existingAbout } = await supabase
      .from('custom_pages')
      .select('id')
      .eq('slug', 'about')
      .single()

    if (!existingAbout) {
      console.log('[v0] Creating about page in custom_pages...')
      
      const aboutPageContent = {
        title: 'Welcome to the Wisdom at Work Fellows\' Portal',
        slug: 'about',
        description: 'This site is your dashboard for the WAW Syllabus, Toolkit, Calendar, and Additional Resources.',
        header1: 'Welcome to the Wisdom at Work Fellows\' Portal',
        header2: null,
        header3: null,
        is_published: true,
        show_in_menu: true,
        created_by: 'system',
      }

      const { data: aboutPage, error: insertError } = await supabase
        .from('custom_pages')
        .insert(aboutPageContent)
        .select()
        .single()

      if (insertError) {
        console.error('[v0] Error creating about page:', insertError)
      } else {
        console.log('[v0] About page created with ID:', aboutPage.id)

        // Add about page content blocks
        const blocks = [
          {
            page_id: aboutPage.id,
            block_type: 'image',
            order_number: 0,
            title: null,
            content: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-yk9hNgyQQIeZ2sMEpmaQzrCr1BlN8x.png',
            metadata: { alt: 'Wisdom at Work Fellows in collaborative discussion' },
            image_id: null,
          },
          {
            page_id: aboutPage.id,
            block_type: 'text',
            order_number: 1,
            title: null,
            content: `School leaders face myriad challenges: handling angry parent emails, managing contentious meetings, and addressing bullying—often before the school day even begins. Each situation demands nuanced thinking and sound judgment, not one-size-fits-all answers. How do school leaders learn to move from reactive mode to calm, wise responses?

Our new initiative, Wisdom at Work, aims to answer that question. We view practical wisdom (phronesis)—the disposition to press pause, deliberate, and respond well—as the antidote to reactive decision-making. Practical wisdom enables leaders to attend to context, engage stakeholders meaningfully, and navigate competing priorities—turning everyday challenges into opportunities to foster flourishing.

Rooted in innovative, research-based design, the Wisdom at Work Fellowship will equip school leaders and their teams with tools and practices they can use to lead with wisdom, even under pressure. Over few years, we will grow a vibrant Community of Fellows—engaging school leaders not just as participants, but as partners in research and design. Together, we are shaping a fresh, field-tested model of professional development, building evidence-based tools, and cultivating a networked Community of Practice.`,
            metadata: null,
            image_id: null,
          },
          {
            page_id: aboutPage.id,
            block_type: 'image',
            order_number: 2,
            title: null,
            content: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-Q4wysyC8JWLi02dGNyrSqptIHF6gYQ.png',
            metadata: { alt: 'Wisdom at Work Three-Year Curriculum Structure' },
            image_id: null,
          },
          {
            page_id: aboutPage.id,
            block_type: 'image',
            order_number: 3,
            title: null,
            content: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-kCoiFTogFnqrrOloeNsvOSi9SOMEDN.png',
            metadata: { alt: 'John Templeton Foundation' },
            image_id: null,
          },
        ]

        const { error: blocksError } = await supabase
          .from('page_blocks')
          .insert(blocks)

        if (blocksError) {
          console.error('[v0] Error creating blocks:', blocksError)
        } else {
          console.log('[v0] About page blocks created successfully')
        }
      }
    } else {
      console.log('[v0] About page already exists in custom_pages')
    }

    console.log('[v0] Database setup completed successfully!')
  } catch (error) {
    console.error('[v0] Database setup error:', error)
  }
}

setupDatabase()
