import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';

const prisma = new PrismaClient();
const app = createApp();

let workspaceId = '';
let otherWorkspaceId = '';
let renderId = '';

beforeAll(async () => {
  const workspace = await prisma.workspace.create({
    data: {
      title: 'Render Vote Test Workspace',
      domainType: 'outfit'
    }
  });

  const otherWorkspace = await prisma.workspace.create({
    data: {
      title: 'Different Workspace',
      domainType: 'outfit'
    }
  });

  const render = await prisma.render.create({
    data: {
      workspaceId: workspace.id,
      renderMode: 'preview',
      selectedItemIds: ['item-a', 'item-b'],
      status: 'complete'
    }
  });

  workspaceId = workspace.id;
  otherWorkspaceId = otherWorkspace.id;
  renderId = render.id;
});

afterAll(async () => {
  await prisma.renderVote.deleteMany({
    where: { renderId }
  });
  await prisma.render.deleteMany({
    where: { id: renderId }
  });
  await prisma.workspace.deleteMany({
    where: {
      id: {
        in: [workspaceId, otherWorkspaceId]
      }
    }
  });
  await prisma.$disconnect();
});

describe('render vote endpoints', () => {
  it('upserts and returns a valid render vote', async () => {
    const response = await request(app)
      .put(`/workspaces/${workspaceId}/renders/${renderId}/vote`)
      .send({ vote: 'up' });

    expect(response.status).toBe(200);
    expect(response.body.data.vote).toBe('up');

    const renderResponse = await request(app).get(`/workspaces/${workspaceId}/renders/${renderId}`);
    expect(renderResponse.status).toBe(200);
    expect(renderResponse.body.data.currentVote).toBe('up');
  });

  it('rejects invalid vote values', async () => {
    const response = await request(app)
      .put(`/workspaces/${workspaceId}/renders/${renderId}/vote`)
      .send({ vote: 'sideways' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns not found when render does not belong to workspace', async () => {
    const response = await request(app)
      .put(`/workspaces/${otherWorkspaceId}/renders/${renderId}/vote`)
      .send({ vote: 'down' });

    expect(response.status).toBe(404);
    expect(response.body.error.message).toBe('Render not found in workspace');
  });

  it('persists vote changes across requests', async () => {
    const updateResponse = await request(app)
      .put(`/workspaces/${workspaceId}/renders/${renderId}/vote`)
      .send({ vote: 'neutral' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.vote).toBe('neutral');

    const getResponse = await request(app).get(`/workspaces/${workspaceId}/renders/${renderId}/vote`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data.vote).toBe('neutral');

    const listResponse = await request(app).get(`/workspaces/${workspaceId}/renders`);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data[0].currentVote).toBe('neutral');
  });
});
