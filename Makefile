.DEFAULT_GOAL := help

.PHONY: help install dev build preview test test-watch lint format format-check lint-fsd typecheck check clean

help: ## show available targets
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  %-14s %s\n", $$1, $$2}'

install: ## install dependencies
	pnpm install

dev: ## start dev server
	pnpm dev

build: ## typecheck and build for production
	pnpm build

preview: ## serve the production build locally
	pnpm preview

test: ## run tests once
	pnpm test

test-watch: ## run tests in watch mode
	pnpm test:watch

lint: ## run oxlint
	pnpm lint

format: ## format code with oxfmt
	pnpm format

format-check: ## check formatting with oxfmt
	pnpm format:check

lint-fsd: ## check FSD boundaries with steiger
	pnpm lint:fsd

typecheck: ## run tsc
	pnpm typecheck

check: ## lint, format check, fsd, typecheck, tests
	pnpm check

clean: ## remove dist, coverage, node_modules/.vite
	pnpm clean
