import axios from 'axios';

import type {NextApiRequest, NextApiResponse} from 'next';

export type TPostOrder = {txHash: 'string'; status: 'string'; expiry: number};
async function JamProxyPost(req: NextApiRequest, res: NextApiResponse<TPostOrder | unknown>): Promise<void> {
	const requestURI = new URL(`https://api-test.bebop.xyz/jam/polygon/v1/order`);

	try {
		const {data} = (await axios.post(
			requestURI.toString(),
			{
				signature: req.body.signature,
				quote_id: req.body.quote_id
			},
			{
				withCredentials: true,
				headers: {
					'Content-Type': 'application/json; charset=utf-8'
				},
				auth: {
					username: `dump`,
					password: String(process.env.BEBOP_JAM_KEY)
				}
			}
		)) as {data: TPostOrder};

		res.status(200).json(data);
	} catch (error) {
		res.status(500).json({error});
	}
}

export default JamProxyPost;
