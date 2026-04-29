.PHONY: help run-dev run-dev-clean install build check db-pull-data db-reset db-push db-status

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development commands (for `run dev` and `run dev clean`)
run-dev: ## Start local development server
	pnpm dev

run-dev-clean: ## Clean build artifacts and start fresh
	rm -rf .next node_modules
	pnpm install
	pnpm dev

install: ## Install dependencies
	pnpm install

build: ## Build for production
	pnpm build

# Code Quality
check: ## Run linter + TypeScript check
	@pnpm lint --quiet || true
	@echo "Running tsc..."
	@pnpm exec tsc --noEmit
	@echo "tsc passed"

# Database commands
DB_URL := postgresql://postgres:postgres@127.0.0.1:54354/postgres

db-pull-data: ## Pull data from remote Supabase to local database
	@echo "Dumping data from remote database..."
	supabase db dump --data-only -f /tmp/remote_data.sql
	@echo "Resetting local database and applying migrations..."
	supabase db reset
	@echo "Clearing seeded tables that conflict with prod data..."
	psql $(DB_URL) -c "TRUNCATE cp_workflow_statuses, cp_content_types CASCADE; TRUNCATE storage.buckets CASCADE;"
	@echo "Restoring data to local database (triggers disabled for circular FKs)..."
	@echo "SET session_replication_role = 'replica';" | cat - /tmp/remote_data.sql | psql $(DB_URL)
	@rm /tmp/remote_data.sql
	@echo "Done! Local database synced with remote data."

db-reset: ## Reset local database (applies migrations, no data)
	supabase db reset

db-push: ## Push local migrations to remote database
	supabase db push

db-status: ## Show local Supabase status
	supabase status
