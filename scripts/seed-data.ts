/**
 * HeySalad QC - Seed Data Script
 * 
 * Creates 5 sample stations with detection rules for demo purposes.
 * Run with: npx tsx scripts/seed-data.ts
 * 
 * Requirements: Demo requirements
 */

const API_BASE = process.env.API_URL || 'http://localhost:8787/api';

interface CreateStationInput {
  name: string;
  type: 'packing' | 'prep' | 'storage' | 'receiving';
  location?: string;
  description?: string;
}

interface DetectionRulesInput {
  expected_items: Array<{ label: string; required: boolean }>;
  confidence_threshold: number;
  alert_config: {
    enabled: boolean;
    triggers: Array<'missing_item' | 'low_confidence' | 'all_failures'>;
  };
}

interface SeedStation {
  station: CreateStationInput;
  rules: DetectionRulesInput;
}

const sampleStations: SeedStation[] = [
  {
    station: {
      name: 'Packing Station 1',
      type: 'packing',
      location: 'Kitchen Area A',
      description: 'Main packing station for delivery orders. Handles salads and bowls.',
    },
    rules: {
      expected_items: [
        { label: 'lettuce', required: true },
        { label: 'tomato', required: true },
        { label: 'container', required: true },
        { label: 'lid', required: false },
      ],
      confidence_threshold: 0.75,
      alert_config: {
        enabled: true,
        triggers: ['missing_item'],
      },
    },
  },
  {
    station: {
      name: 'Prep Station A',
      type: 'prep',
      location: 'Kitchen Area B',
      description: 'Vegetable preparation station. Handles cutting and washing.',
    },
    rules: {
      expected_items: [
        { label: 'cutting_board', required: true },
        { label: 'knife', required: true },
        { label: 'gloves', required: true },
      ],
      confidence_threshold: 0.80,
      alert_config: {
        enabled: true,
        triggers: ['missing_item', 'low_confidence'],
      },
    },
  },
  {
    station: {
      name: 'Cold Storage Check',
      type: 'storage',
      location: 'Walk-in Cooler',
      description: 'Temperature-controlled storage area for fresh ingredients.',
    },
    rules: {
      expected_items: [
        { label: 'temperature_display', required: true },
        { label: 'sealed_containers', required: true },
      ],
      confidence_threshold: 0.70,
      alert_config: {
        enabled: false,
        triggers: [],
      },
    },
  },
  {
    station: {
      name: 'Receiving Dock',
      type: 'receiving',
      location: 'Back Entrance',
      description: 'Delivery receiving area. Inspects incoming produce shipments.',
    },
    rules: {
      expected_items: [
        { label: 'delivery_box', required: true },
        { label: 'invoice', required: true },
        { label: 'thermometer', required: false },
      ],
      confidence_threshold: 0.75,
      alert_config: {
        enabled: true,
        triggers: ['all_failures'],
      },
    },
  },
  {
    station: {
      name: 'Packing Station 2',
      type: 'packing',
      location: 'Kitchen Area A',
      description: 'Secondary packing station for high-volume periods.',
    },
    rules: {
      expected_items: [
        { label: 'lettuce', required: true },
        { label: 'protein', required: true },
        { label: 'dressing', required: false },
        { label: 'container', required: true },
      ],
      confidence_threshold: 0.75,
      alert_config: {
        enabled: false,
        triggers: [],
      },
    },
  },
];

async function createStation(data: CreateStationInput): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE}/stations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create station: ${error}`);
  }

  return response.json();
}

async function setDetectionRules(stationId: string, rules: DetectionRulesInput): Promise<void> {
  const response = await fetch(`${API_BASE}/stations/${stationId}/rules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rules),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to set detection rules: ${error}`);
  }
}

async function seedData(): Promise<void> {
  console.log('🥗 HeySalad QC - Seeding sample data...\n');
  console.log(`API Base: ${API_BASE}\n`);

  for (const { station, rules } of sampleStations) {
    try {
      console.log(`Creating station: ${station.name}...`);
      const created = await createStation(station);
      console.log(`  ✓ Created with ID: ${created.id}`);

      console.log(`  Setting detection rules...`);
      await setDetectionRules(created.id, rules);
      console.log(`  ✓ Rules configured\n`);
    } catch (error) {
      console.error(`  ✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }
  }

  console.log('✅ Seed data complete!');
}

// Run the seed script
seedData().catch(console.error);
