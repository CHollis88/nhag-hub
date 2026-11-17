// Verse of the Day: a hand-picked list of well-known verses, shown on Home
// in the reader's KJV or BSB. Each day moves one place down the list
// (counting days since 1 Jan 2000), so a verse doesn't land on the same date
// every year. Every reference was checked against both the KJV and BSB text
// when the list was made. "Jhn 3:16" = the app's book code + chapter:verse.
export const VERSE_OF_DAY = `
Gen 1:1|Gen 1:27|Gen 12:2|Gen 28:15|Gen 50:20|Exo 14:14|Exo 15:2|Exo 20:3|Exo 33:14|Num 6:24|
Num 6:25|Num 6:26|Num 23:19|Deu 6:5|Deu 31:6|Deu 31:8|Deu 7:9|Deu 8:3|Deu 10:12|Deu 30:19|
Jos 1:8|Jos 1:9|Jos 24:15|Jdg 6:12|Rth 1:16|1Sa 2:2|1Sa 12:24|1Sa 16:7|2Sa 22:2|2Sa 22:31|
1Ki 8:56|1Ch 16:11|1Ch 16:34|1Ch 29:11|2Ch 7:14|2Ch 16:9|2Ch 20:15|Neh 8:10|Est 4:14|Job 19:25|
Job 1:21|Job 23:10|Job 42:2|Psa 1:1|Psa 1:2|Psa 1:3|Psa 4:8|Psa 5:3|Psa 9:1|Psa 9:10|
Psa 16:8|Psa 16:11|Psa 18:2|Psa 19:1|Psa 19:14|Psa 20:7|Psa 23:1|Psa 23:4|Psa 23:6|Psa 24:1|
Psa 25:4|Psa 27:1|Psa 27:4|Psa 27:14|Psa 28:7|Psa 29:11|Psa 30:5|Psa 31:24|Psa 32:8|Psa 33:12|
Psa 34:1|Psa 34:8|Psa 34:18|Psa 37:4|Psa 37:5|Psa 37:7|Psa 40:1|Psa 42:11|Psa 46:1|Psa 46:10|
Psa 51:10|Psa 55:22|Psa 56:3|Psa 61:2|Psa 62:1|Psa 62:8|Psa 63:1|Psa 66:20|Psa 68:19|Psa 71:5|
Psa 73:26|Psa 84:10|Psa 84:11|Psa 86:5|Psa 89:1|Psa 90:12|Psa 91:1|Psa 91:2|Psa 91:11|Psa 95:6|
Psa 96:1|Psa 100:4|Psa 100:5|Psa 103:1|Psa 103:2|Psa 103:12|Psa 107:1|Psa 112:7|Psa 118:24|Psa 119:11|
Psa 119:105|Psa 119:114|Psa 121:1|Psa 121:2|Psa 121:8|Psa 126:5|Psa 127:1|Psa 133:1|Psa 136:1|Psa 138:8|
Psa 139:14|Psa 139:23|Psa 143:8|Psa 145:18|Psa 147:3|Psa 150:6|Pro 3:5|Pro 3:6|Pro 4:23|Pro 9:10|
Pro 11:25|Pro 12:25|Pro 14:12|Pro 15:1|Pro 16:3|Pro 16:9|Pro 17:17|Pro 18:10|Pro 18:24|Pro 19:21|
Pro 22:6|Pro 27:17|Pro 29:25|Pro 31:25|Pro 31:30|Ecc 3:1|Ecc 3:11|Ecc 4:9|Ecc 12:13|Sng 8:7|
Isa 9:6|Isa 12:2|Isa 25:1|Isa 26:3|Isa 26:4|Isa 30:15|Isa 30:18|Isa 33:2|Isa 40:8|Isa 40:29|
Isa 40:31|Isa 41:10|Isa 41:13|Isa 43:1|Isa 43:2|Isa 43:19|Isa 49:16|Isa 53:5|Isa 54:10|Isa 54:17|
Isa 55:6|Isa 55:8|Isa 55:9|Isa 55:11|Isa 58:11|Isa 60:1|Isa 61:1|Isa 64:8|Isa 65:24|Jer 1:5|
Jer 17:7|Jer 17:14|Jer 29:11|Jer 29:12|Jer 29:13|Jer 31:3|Jer 32:17|Jer 33:3|Lam 3:22|Lam 3:23|
Lam 3:25|Eze 36:26|Dan 2:20|Dan 3:17|Dan 6:22|Hos 6:3|Joe 2:13|Joe 2:28|Amo 5:24|Jon 2:9|
Mic 6:8|Mic 7:7|Nah 1:7|Hab 3:17|Hab 3:18|Hab 3:19|Zep 3:17|Hag 2:4|Zec 4:6|Mal 3:10|
Mat 4:4|Mat 5:3|Mat 5:6|Mat 5:8|Mat 5:9|Mat 5:14|Mat 5:16|Mat 5:44|Mat 6:6|Mat 6:20|
Mat 6:21|Mat 6:33|Mat 6:34|Mat 7:7|Mat 7:12|Mat 7:24|Mat 9:37|Mat 11:28|Mat 11:29|Mat 16:24|
Mat 17:20|Mat 18:20|Mat 19:26|Mat 22:37|Mat 22:39|Mat 24:35|Mat 28:6|Mat 28:19|Mat 28:20|Mar 9:23|
Mar 10:27|Mar 10:45|Mar 11:24|Mar 12:30|Mar 16:15|Luk 1:37|Luk 1:45|Luk 2:10|Luk 2:11|Luk 6:31|
Luk 6:38|Luk 9:23|Luk 11:9|Luk 12:32|Luk 15:7|Luk 18:27|Luk 19:10|Jhn 1:1|Jhn 1:5|Jhn 1:12|
Jhn 1:14|Jhn 3:16|Jhn 3:17|Jhn 4:24|Jhn 5:24|Jhn 6:35|Jhn 8:12|Jhn 8:32|Jhn 8:36|Jhn 10:10|
Jhn 10:11|Jhn 10:27|Jhn 10:28|Jhn 11:25|Jhn 13:34|Jhn 13:35|Jhn 14:1|Jhn 14:2|Jhn 14:6|Jhn 14:13|
Jhn 14:15|Jhn 14:26|Jhn 14:27|Jhn 15:5|Jhn 15:7|Jhn 15:12|Jhn 15:13|Jhn 15:16|Jhn 16:24|Jhn 16:33|
Jhn 17:17|Jhn 20:29|Act 1:8|Act 2:38|Act 2:42|Act 4:12|Act 16:31|Act 17:28|Act 20:35|Rom 1:16|
Rom 3:23|Rom 5:1|Rom 5:5|Rom 5:8|Rom 6:23|Rom 8:1|Rom 8:18|Rom 8:28|Rom 8:31|Rom 8:37|
Rom 8:38|Rom 8:39|Rom 10:9|Rom 10:17|Rom 12:1|Rom 12:2|Rom 12:10|Rom 12:12|Rom 12:21|Rom 15:4|
Rom 15:13|1Co 2:9|1Co 6:19|1Co 10:13|1Co 10:31|1Co 13:4|1Co 13:7|1Co 13:13|1Co 15:57|1Co 15:58|
1Co 16:13|1Co 16:14|2Co 1:3|2Co 1:4|2Co 3:17|2Co 4:16|2Co 4:17|2Co 4:18|2Co 5:7|2Co 5:17|
2Co 9:7|2Co 9:8|2Co 12:9|2Co 12:10|Gal 2:20|Gal 5:1|Gal 5:13|Gal 5:22|Gal 5:23|Gal 6:2|
Gal 6:9|Eph 1:7|Eph 2:8|Eph 2:9|Eph 2:10|Eph 3:20|Eph 4:2|Eph 4:29|Eph 4:32|Eph 5:2|
Eph 6:10|Eph 6:11|Phl 1:6|Phl 1:21|Phl 2:3|Phl 2:4|Phl 2:13|Phl 3:13|Phl 3:14|Phl 4:4|
Phl 4:6|Phl 4:7|Phl 4:8|Phl 4:11|Phl 4:13|Phl 4:19|Col 1:17|Col 2:6|Col 3:2|Col 3:12|
Col 3:13|Col 3:15|Col 3:17|Col 3:23|Col 4:2|1Th 5:11|1Th 5:16|1Th 5:17|1Th 5:18|2Th 3:3|
1Ti 4:12|1Ti 6:6|2Ti 1:7|2Ti 2:15|2Ti 3:16|Tit 3:5|Heb 4:12|Heb 4:16|Heb 10:23|Heb 10:24|
Heb 11:1|Heb 11:6|Heb 12:1|Heb 12:2|Heb 13:5|Heb 13:8|Jas 1:2|Jas 1:5|Jas 1:12|Jas 1:17|
Jas 1:22|Jas 4:7|Jas 4:8|Jas 5:16|1Pe 2:9|1Pe 3:15|1Pe 4:8|1Pe 4:10|1Pe 5:6|1Pe 5:7|
2Pe 1:3|2Pe 3:9|1Jo 1:9|1Jo 3:1|1Jo 3:18|1Jo 4:4|1Jo 4:7|1Jo 4:8|1Jo 4:18|1Jo 4:19|
1Jo 5:14|3Jo 1:2|Jde 1:24|Jde 1:25|Rev 3:20|Rev 21:4|
`.split("|").map((s) => s.trim()).filter(Boolean);
