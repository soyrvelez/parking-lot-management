# Project Structure

## Root Directory
```
parking-lot-management/
├── src/                    # All source code
├── prisma/                 # Database schema and migrations
├── tests/                  # Test files and setup
├── config/                 # Configuration files
├── scripts/                # Utility scripts (seeding, printer test)
├── docs/                   # Documentation
│   ├── api/               # API documentation
│   ├── deployment/        # Deployment guides
│   └── user-guides/       # User manuals
├── public/                 # Static assets
└── .serena/               # Serena tool configuration
```

## Source Code Structure
```
src/
├── backend/               # Node.js/Express backend
│   ├── routes/           # API endpoint definitions
│   ├── middleware/       # Auth, validation, error handling
│   ├── services/         # Business logic layer
│   ├── models/           # Prisma database models
│   ├── utils/            # Helper functions
│   ├── types/            # TypeScript type definitions
│   ├── app.ts           # Express app configuration
│   └── server.ts        # Server entry point
│
├── frontend/             # Next.js frontend
│   ├── components/       # React components
│   ├── pages/           # Next.js page routes
│   ├── hooks/           # Custom React hooks
│   ├── stores/          # Zustand state stores
│   ├── utils/           # Frontend utilities
│   └── next.config.js   # Next.js configuration
│
└── shared/              # Shared between frontend/backend
    ├── types/           # Common TypeScript types
    ├── constants/       # Application constants
    └── utils/           # Shared utility functions
```

## Key Files
- `CLAUDE.md` - Project context and guidelines
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `.eslintrc.js` - ESLint rules
- `jest.config.js` - Jest test configuration
- `docker-compose.yml` - Docker setup
- `.env.example` - Environment variables template