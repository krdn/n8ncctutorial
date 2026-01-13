#!/usr/bin/env node

/**
 * n8n Workflow Manager CLI
 * n8n 워크플로우를 커맨드라인에서 관리하는 도구
 */

import { program } from './cli/index.js';

// CLI 실행
program.parse();
