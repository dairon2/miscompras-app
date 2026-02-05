
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Copy-paste key helper logic from service to reproduce exact behavior
const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

async function main() {
    console.log("--- DEBUGGING SUBMISSION RULES ---");

    // 1. Check Rules in DB
    const rules = await prisma.submissionRule.findMany({
        where: { isActive: true },
        orderBy: { priority: 'desc' }
    });
    console.log(`Found ${rules.length} active rules in DB:`);
    console.table(rules.map(r => ({
        id: r.id,
        name: r.name,
        day: `${r.dayOfWeek} (${dayNames[r.dayOfWeek]})`,
        start: r.startTime,
        end: r.endTime,
        isHolidayRule: r.isHolidayRule
    })));

    if (rules.length === 0) {
        console.log("!!! NO RULES FOUND. Submission is ALLOWED by default if no rules exist. !!!");
    }

    // 2. Check Time
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const colombiaTime = new Date(utcTime - (5 * 60 * 60000));

    console.log("\n--- TIME CALCULATION ---");
    console.log("Server Local Time:", now.toString());
    console.log("Calculated Colombia Time:", colombiaTime.toString());
    console.log("Day Index:", colombiaTime.getDay());
    console.log("Day Name:", dayNames[colombiaTime.getDay()]);

    // 3. Check Holidays
    // Logic from service: check previous workday
    const getPreviousWorkday = (date: Date): Date => {
        const prev = new Date(date);
        prev.setDate(prev.getDate() - 1);
        if (prev.getDay() === 0) prev.setDate(prev.getDate() - 2);
        else if (prev.getDay() === 6) prev.setDate(prev.getDate() - 1);
        return prev;
    };

    const prevWorkday = getPreviousWorkday(colombiaTime);
    console.log(`\nPrevious Workday: ${prevWorkday.toISOString()} (${dayNames[prevWorkday.getDay()]})`);

    const startOfDay = new Date(prevWorkday); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(prevWorkday); endOfDay.setHours(23, 59, 59, 999);

    const holiday = await prisma.colombianHoliday.findFirst({
        where: {
            date: { gte: startOfDay, lte: endOfDay }
        }
    });

    console.log(`Is Previous Workday Holiday in DB? ${holiday ? 'YES: ' + holiday.name : 'NO'}`);

    console.log("\n--- CONCLUSION ---");
    if (rules.length === 0) {
        console.log("RESULT: Allowed because NO RULES exist.");
    } else {
        // Simple manual check of logic against found rules
        const currentMinutes = colombiaTime.getHours() * 60 + colombiaTime.getMinutes();
        const currentDay = colombiaTime.getDay();
        const isPrevHoliday = !!holiday;

        let matched = false;
        for (const rule of rules) {
            // Logic copy from service
            if (rule.isHolidayRule) {
                if (!isPrevHoliday) continue;
            } else {
                if (isPrevHoliday) {
                    const hasHolidayRuleForToday = rules.some(r => r.isHolidayRule && r.dayOfWeek === currentDay);
                    if (hasHolidayRuleForToday) continue;
                }
            }

            if (rule.dayOfWeek !== currentDay) continue;

            const start = timeToMinutes(rule.startTime);
            const end = timeToMinutes(rule.endTime);

            if (currentMinutes >= start && currentMinutes <= end) {
                console.log(`MATCHED RULE: ${rule.name} (Start: ${rule.startTime}, End: ${rule.endTime})`);
                matched = true;
                break;
            }
        }

        if (matched) {
            console.log("RESULT: Allowed by matching rule.");
        } else {
            console.log("RESULT: DENIED (No matching rule found).");
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
