# Claude Development Notes

## Deployment

This project has an **auto-deployment pipeline**. Do NOT try to deploy manually with `partykit deploy`.

Just push to GitHub and the deployment will happen automatically.

## Tech Stack

- Frontend: React + Vite + TailwindCSS
- Backend: PartyKit (WebSocket server)
- Hosting: PartyKit (betrayal-game.sat-b.partykit.dev)

## Known Issues

- PartyKit CLI has Windows path issues with `partykit deploy` command
- Use GitHub auto-deploy pipeline instead
