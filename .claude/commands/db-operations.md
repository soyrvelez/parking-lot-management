# Database Operations

Perform database operations for the parking lot management system: $ARGUMENTS

## Available Operations:
1. **reset** - Reset database to clean state
2. **seed** - Populate with sample data
3. **migrate** - Apply pending migrations
4. **backup** - Create database backup
5. **restore** - Restore from backup
6. **schema** - Display current schema
7. **studio** - Open Prisma Studio

## Steps:
1. Validate current database state
2. Perform requested operation with safety checks
3. Verify operation completed successfully
4. Update any related configuration
5. Run basic validation queries

## Arguments:
- `reset` - Reset database and apply all migrations
- `seed` - Add sample data for development/testing
- `migrate` - Create and apply new migration
- `backup` - Create timestamped backup file
- `restore <backup-file>` - Restore from specific backup
- `schema` - Show current database schema
- `studio` - Launch Prisma Studio for database inspection

## Usage: /project:db-operations reset