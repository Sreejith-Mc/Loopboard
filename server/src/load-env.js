// Loads the repo-root .env regardless of the working directory.
//
// This lives in its own module, imported before ./app.js, because ES modules
// are evaluated in import order: by the time app.js (and through it db.js)
// runs, the variables must already be on process.env. It also can't rely on
// dotenv's default lookup, since `npm run dev -w server` sets the working
// directory to server/, where there is no .env.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '..', '..', '.env') });
