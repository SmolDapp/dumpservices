import {Telegram} from 'telegraf';

import type {NextApiRequest, NextApiResponse} from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse<boolean>): Promise<void> {
	if (!process?.env?.TELEGRAM_BOT || !process?.env?.TELEGRAM_CHAT) {
		return res.status(200).json(true);
	}
	try {
		const telegram = new Telegram(process.env.TELEGRAM_BOT as string);
		const {messages} = req.body as {messages: string[]};

		await telegram.sendMessage(process.env.TELEGRAM_CHAT as string, messages.join('\n'), {
			parse_mode: 'Markdown',
			link_preview_options: {
				is_disabled: true
			}
		});
		return res.status(200).json(true);
	} catch (error) {
		console.error(error);
		return res.status(500).json(false);
	}
}
