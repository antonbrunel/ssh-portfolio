export { CYBERSIGILISM as ASCII_PORTRAIT } from './ascii';

export type Lang = 'en' | 'fr';

interface LangContent {
  tagline: string;
  tabs: readonly [string, string, string];
  pitch: string[];
  about: string[];
  projects: Array<{
    name: string;
    tags: string;
    description: string[];
  }>;
  contact: Array<{ label: string; value: string }>;
  hints: {
    home: string;
    projects: string;
    section: string;
  };
  goodbye: string;
}

export const CONTENT: { name: string } & Record<Lang, LangContent> = {
  name: 'ANTON BRUNEL',

  en: {
    tagline: 'Product Builder  ·  AI  ·  Voice  ·  Automation  ·  Funnels',
    tabs: ['PROJECTS', 'ABOUT', 'CONTACT'],
    pitch: [
      'I build real products with AI.',
      'Not a developer,',
      'a builder who ships.',
      '',
      'Idea to live product',
      'in days, not months.',
    ],
    about: [
      'I orchestrate AI, automation,',
      'and product thinking to build',
      'systems that work in production.',
      '',
      'From voice assistants to',
      'conversion funnels. I ship',
      'real things, fast.',
      '',
      'My value is not the code.',
      'It\'s knowing what to build,',
      'why it matters, and how',
      'to make it ship.',
      '',
      'Speed over perfection.',
      'Real products. Real usage.',
    ],
    projects: [
      {
        name: 'Step Up Factory',
        tags: 'Fitness · Lead Gen · Booking',
        description: [
          'Visual proof engine + booking system',
          'for a fitness studio. Before/After,',
          'funnels, and n8n automation.',
        ],
      },
      {
        name: "D'Artgil Café",
        tags: 'Voice AI · Gemini Live · Real-time',
        description: [
          'Real-time voice AI for a local',
          'business. Bidirectional streaming,',
          'instant FAQ and booking.',
        ],
      },
      {
        name: 'QSE Brunel',
        tags: 'Training · AI · Analytics',
        description: [
          'Immersive industrial training platform.',
          'AI scenario generation, investigation',
          'engine, and performance analytics.',
        ],
      },
      {
        name: 'Sudoku Multiplayer',
        tags: 'Real-time · Game · Sync',
        description: [
          'Collaborative game with live state sync.',
          'Cooperative & Versus modes.',
          'Designed to be actually enjoyable.',
        ],
      },
    ],
    contact: [
      { label: 'Email',   value: 'antton.brunel@gmail.com' },
      { label: 'GitHub',  value: 'github.com/antonbrunel' },
      { label: 'Website', value: 'antton-brunel.com' },
    ],
    hints: {
      home:     '  ← → select  ·  ENTER open  ·  L lang  ·  Q quit',
      projects: '  ↑ ↓ navigate  ·  ESC / Q back  ·  L lang  ·  Ctrl+C quit',
      section:  '  ESC / Q back  ·  L lang  ·  Ctrl+C quit',
    },
    goodbye: 'Connection closed.',
  },

  fr: {
    tagline: 'Product Builder  ·  IA  ·  Voix  ·  Automatisation  ·  Funnels',
    tabs: ['PROJETS', 'À PROPOS', 'CONTACT'],
    pitch: [
      'Je construis de vrais produits',
      'avec l\'IA.',
      'Pas développeur,',
      'un builder qui livre.',
      '',
      'De l\'idée au live en jours,',
      'pas en mois.',
    ],
    about: [
      'J\'orchestre IA, automatisation',
      'et logique produit pour bâtir',
      'des systèmes qui tournent.',
      '',
      'Des assistants vocaux aux',
      'tunnels de conversion. Je livre',
      'des choses réelles, vite.',
      '',
      'Ma valeur, ce n\'est pas le code.',
      'C\'est savoir quoi construire,',
      'pourquoi ça compte, et comment',
      'le faire tourner en production.',
      '',
      'Vitesse avant perfection.',
      'Produits réels. Usage réel.',
    ],
    projects: [
      {
        name: 'Step Up Factory',
        tags: 'Fitness · Lead Gen · Réservation',
        description: [
          'Preuve visuelle de résultats + système',
          'de réservation. Éditeur Avant/Après,',
          'funnels et automation n8n.',
        ],
      },
      {
        name: "D'Artgil Café",
        tags: 'IA Vocale · Gemini Live · Temps réel',
        description: [
          'IA vocale temps réel pour un commerce',
          'local. Streaming bidirectionnel,',
          'FAQ instantanée et prise de RDV.',
        ],
      },
      {
        name: 'QSE Brunel',
        tags: 'Formation · IA · Analytics',
        description: [
          'Plateforme de formation industrielle.',
          'Génération de scénarios IA, moteur',
          'd\'investigation, analytics.',
        ],
      },
      {
        name: 'Sudoku Multiplayer',
        tags: 'Temps réel · Jeu · Sync',
        description: [
          'Jeu collaboratif avec sync live.',
          'Modes Coopératif & Versus.',
          'Conçu pour être vraiment agréable.',
        ],
      },
    ],
    contact: [
      { label: 'Email',  value: 'antton.brunel@gmail.com' },
      { label: 'GitHub', value: 'github.com/antonbrunel' },
      { label: 'Site',   value: 'antton-brunel.com' },
    ],
    hints: {
      home:     '  ← → choisir  ·  ENTER ouvrir  ·  L langue  ·  Q quitter',
      projects: '  ↑ ↓ naviguer  ·  ESC / Q retour  ·  L langue  ·  Ctrl+C quitter',
      section:  '  ESC / Q retour  ·  L langue  ·  Ctrl+C quitter',
    },
    goodbye: 'Connexion fermée.',
  },
};
