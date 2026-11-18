import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Images are optional: with no `src`, a placeholder is drawn. `alt` is always required.
const image = z.object({
  src: z.string().startsWith('/images/').optional(),
  alt: z.string().min(1),
});

const link = z.object({ label: z.string(), href: z.string() });

// Brand rule: formal tone, no exclamation marks in any copy.
const text = z.string().refine((s) => !s.includes('!'), 'No exclamation marks (brand rule)');

const heading = z.object({ heading: text, intro: text.optional() });

const cta = z.object({ heading: text, text, button: link });

const page = (file: string) => glob({ pattern: file, base: './src/content/pages' });

const site = defineCollection({
  loader: glob({ pattern: 'site.json', base: './src/content/site' }),
  schema: z.object({
    name: z.string(),
    description: text,
    nav: z.array(link).min(1),
    phone: z.string(),
    email: z.string().email(),
    depots: z
      .array(z.object({ name: z.string(), address: z.array(z.string()).min(1), phone: z.string() }))
      .min(1),
  }),
});

const services = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/services' }),
  schema: z.object({
    title: text,
    order: z.number().int(),
    summary: text,
    detail: text,
    points: z.array(text).min(1),
    image,
  }),
});

const sectors = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/sectors' }),
  schema: z.object({
    title: text,
    order: z.number().int(),
    summary: text,
    needs: z.array(text).min(1),
  }),
});

const home = defineCollection({
  loader: page('home.json'),
  schema: z.object({
    title: z.string(),
    description: text,
    hero: z.object({
      heading: text,
      text,
      image,
      primaryCta: link,
      secondaryCta: link.optional(),
    }),
    services: heading,
    stats: z.array(z.object({ value: z.string(), label: text })).min(2).max(4),
    sectors: heading,
    cta,
  }),
});

const servicesPage = defineCollection({
  loader: page('services.json'),
  schema: z.object({ title: z.string(), description: text, heading: text, intro: text, cta }),
});

const sectorsPage = defineCollection({
  loader: page('sectors.json'),
  schema: z.object({ title: z.string(), description: text, heading: text, intro: text, cta }),
});

const about = defineCollection({
  loader: page('about.json'),
  schema: z.object({
    title: z.string(),
    description: text,
    heading: text,
    intro: text,
    image,
    history: z.object({
      heading: text,
      milestones: z.array(z.object({ year: z.string(), text })).min(1),
    }),
    // Brand rule: no claims of specific accreditations unless already here.
    accreditations: z.object({
      heading: text,
      intro: text,
      items: z.array(z.object({ name: text, note: text })),
    }),
    leadership: z.object({
      heading: text,
      people: z.array(z.object({ name: z.string(), role: text, bio: text, image })).min(1),
    }),
  }),
});

const contact = defineCollection({
  loader: page('contact.json'),
  schema: z.object({
    title: z.string(),
    description: text,
    heading: text,
    intro: text,
    depotsHeading: text,
    form: z.object({
      heading: text,
      nameLabel: text,
      companyLabel: text,
      emailLabel: text,
      phoneLabel: text,
      serviceLabel: text,
      servicePlaceholder: text,
      otherOption: text,
      messageLabel: text,
      submitLabel: text,
      successMessage: text,
    }),
  }),
});

// Landing pages: one JSON file per campaign; the file name is the URL slug.
const campaigns = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/campaigns' }),
  schema: z.object({
    title: z.string(),
    description: text,
    hero: z.object({ eyebrow: text.optional(), heading: text, text, image, cta: link }),
    intro: z.array(text).min(1),
    benefitsHeading: text,
    benefits: z.array(z.object({ title: text, text })).length(3),
    proof: z.object({ value: z.string(), label: text, text }),
    cta,
    faq: z
      .object({
        heading: text,
        items: z.array(z.object({ question: text, answer: text })).min(1),
      })
      .optional(),
  }),
});

export const collections = {
  site,
  services,
  sectors,
  home,
  servicesPage,
  sectorsPage,
  about,
  contact,
  campaigns,
};
