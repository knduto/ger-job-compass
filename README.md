# Germany Job Explorer

I am planning to move to Germany on chancekarte and i want to scale the my  job such by creating an interactive web interface that i can explore job in my sector (to share resume), can do pipelines, can view employers, view data health, filter data by different createria available. do reports based on cities. this reports will be data driven since they will help me select a settlement city. I need a tab to fetch available live data daily and generaly i have a growing database that can be accessed and analysed.  Good news — the Bundesagentur für Arbeit (Arbeitsagentur) actually exposes a public, undocumented-but-usable REST API that their own official Jobsuche app uses. There's a well-known community project on GitHub (bundesAPI/jobsuche-api) that documents it, so you don't need to scrape HTML at all.

How it works

Base URL: https://rest.arbeitsagentur.de/jobboerse/jobsuche-service

Search endpoint: GET https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs (or pc/v4/app/jobs), which lets you filter available job postings with various GET parameters GitHub

Auth: if a client_id doesn't work, you can instead use the header "X-API-KEY: jobboerse-jobsuche" GitHub — this is the public key the app itself uses, so no registration needed.

Detail lookup: the typical flow is search via /pc/v6/jobs or /pc/v4/app/jobs, note the refnr from the response, then fetch details via /pc/v4/jobdetails/{base64(refnr)}, GitHub where the encryptedJobCode is just the Base64-encoded value of the refnr from the search response. Also see https://jobsuche.api.bund.dev/ fetch all the parameters posible more https://github.com/bundesAPI/jobsuche-api/blob/main/README.md

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ger-job-compass.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/50f579f7-6d0a-498c-9333-f436849fea3e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
