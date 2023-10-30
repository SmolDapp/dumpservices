import axios from 'axios';

import type {NextApiRequest, NextApiResponse} from 'next';
import type {TBebopJamQuoteAPIResp} from 'utils/types';

async function JamProxy(req: NextApiRequest, res: NextApiResponse<TBebopJamQuoteAPIResp | unknown>): Promise<void> {
	const requestURI = new URL(`https://api-test.bebop.xyz/jam/polygon/v1/quote`);
	for (const query of Object.entries(req.query)) {
		requestURI.searchParams.append(query[0], query[1] as string);
	}

	try {
		const {data} = (await axios.get(requestURI.toString(), {
			auth: {
				username: `dump`,
				password: String(process.env.BEBOP_JAM_KEY)
			}
		})) as {data: TBebopJamQuoteAPIResp};

		res.status(200).json(data);
	} catch (error) {
		res.status(500).json({error});
	}
}

export default JamProxy;
