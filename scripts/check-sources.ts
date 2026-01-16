
import { getEnabledSources, getSourceConfigs } from '../src/literature/collector';

console.log('=== Enabled Sources ===');
console.log(getEnabledSources());

console.log('\n=== Source Configs ===');
getSourceConfigs().forEach(config => {
    console.log(`${config.source}: enabled=${config.enabled}, apiKeyEnv=${config.apiKeyEnvVar || 'none'}`);
});
