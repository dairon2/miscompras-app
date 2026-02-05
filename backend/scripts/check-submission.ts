
import { checkSubmissionAllowed } from '../src/services/submissionRulesService';

async function check() {
    console.log('--- Checking for USER role ---');
    const userResult = await checkSubmissionAllowed('USER');
    console.log('Can USER submit?', userResult.canSubmit);
    console.log('Message:', userResult.message);
    if (!userResult.canSubmit) {
        console.log('Next available:', userResult.nextAvailable);
    }

    console.log('\n--- Checking for LEADER role ---');
    const leaderResult = await checkSubmissionAllowed('LEADER');
    console.log('Can LEADER submit?', leaderResult.canSubmit);
}

check().catch(console.error);
