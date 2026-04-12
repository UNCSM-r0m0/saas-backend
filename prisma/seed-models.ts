import { PrismaClient, ModelTier } from '@prisma/client';

const prisma = new PrismaClient();

interface ModelConfigInput {
  name: string;
  displayName: string;
  provider: string;
  tier: ModelTier;
  isDefault?: boolean;
  maxTokens?: number;
  capabilities?: string[];
  description?: string;
  sortOrder?: number;
}

// Parse comma-separated env var into array of names
function parseModelList(envVar: string | undefined): string[] {
  if (!envVar) return [];
  return envVar.split(',').map(s => s.trim()).filter(Boolean);
}

// Map model name to a human-readable display name
function getDisplayName(modelName: string): string {
  // Capitalize words, replace hyphens/colons with spaces
  return modelName
    .replace(/[:.-]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Infer provider from model name
function inferProvider(modelName: string): string {
  if (modelName.includes('deepseek')) return 'deepseek';
  if (modelName.includes('gemini')) return 'gemini';
  if (modelName.includes('gpt') || modelName.includes('o1') || modelName.includes('o3') || modelName.includes('o4')) return 'openai';
  // Default to ollama for proxy models
  return 'ollama';
}

async function main() {
  console.log('🌱 Seeding model configurations...');

  const publicModels = parseModelList(process.env.PUBLIC_MODELS);
  const proModels = parseModelList(process.env.PRO_MODELS);
  const freeTierTokens = parseInt(process.env.FREE_USER_MAX_TOKENS || '512', 10);
  const registeredTierTokens = parseInt(process.env.REGISTERED_USER_MAX_TOKENS || '2048', 10);
  const premiumTierTokens = parseInt(process.env.PREMIUM_USER_MAX_TOKENS || '8192', 10);

  const allModels: ModelConfigInput[] = [];

  // Public models → FREE tier
  let isFirstPublic = true;
  for (const name of publicModels) {
    allModels.push({
      name,
      displayName: getDisplayName(name),
      provider: inferProvider(name),
      tier: ModelTier.FREE,
      maxTokens: freeTierTokens,
      capabilities: ['text-generation'],
      isDefault: isFirstPublic,
      sortOrder: allModels.length,
    });
    isFirstPublic = false;
  }

  // Pro models → PREMIUM tier
  for (const name of proModels) {
    allModels.push({
      name,
      displayName: getDisplayName(name),
      provider: inferProvider(name),
      tier: ModelTier.PREMIUM,
      maxTokens: premiumTierTokens,
      capabilities: ['text-generation'],
      sortOrder: 100 + allModels.length,
    });
  }

  // Insert or update each model
  for (const model of allModels) {
    await prisma.modelConfig.upsert({
      where: { name: model.name },
      update: {
        displayName: model.displayName,
        provider: model.provider,
        tier: model.tier,
        maxTokens: model.maxTokens,
        capabilities: model.capabilities || [],
        description: model.description,
        sortOrder: model.sortOrder || 0,
      },
      create: {
        name: model.name,
        displayName: model.displayName,
        provider: model.provider,
        tier: model.tier,
        isActive: true,
        isDefault: model.isDefault || false,
        maxTokens: model.maxTokens,
        capabilities: model.capabilities || [],
        description: model.description,
        sortOrder: model.sortOrder || 0,
      },
    });
    console.log(`  ✅ Seeded: ${model.name} (${model.tier})`);
  }

  console.log(`🌱 Seeded ${allModels.length} models`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
