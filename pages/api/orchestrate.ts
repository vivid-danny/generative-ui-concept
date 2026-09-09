import type { NextApiRequest, NextApiResponse } from 'next'

import { callModel } from '@/orchestration/bridge'

/**
 * Thin wrapper over the local bridge, for poking the orchestrator by hand:
 *
 *   curl -s localhost:3000/api/orchestrate -X POST \
 *     -H 'content-type: application/json' -d '{"message":"..."}'
 *
 * The page itself does not go through here — `LiveProvider` calls `callModel`
 * directly from `getServerSideProps`, which is already server-side, so an HTTP
 * hop back into our own server would buy nothing.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'POST only' })
        return
    }

    const message = (req.body as { message?: unknown })?.message
    if (typeof message !== 'string' || message.trim() === '') {
        res.status(400).json({ error: 'body must be { message: string }' })
        return
    }

    try {
        res.status(200).json(await callModel(message))
    } catch (error) {
        res.status(502).json({ error: error instanceof Error ? error.message : 'unknown error' })
    }
}
