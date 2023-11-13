import axios from 'axios';

import type {NextApiRequest, NextApiResponse} from 'next';
import type {TBebopJamOrderStatusAPIResp} from 'utils/types';

async function JamProxyOrderStatus(
	req: NextApiRequest,
	res: NextApiResponse<TBebopJamOrderStatusAPIResp | unknown>
): Promise<void> {
	const requestURI = new URL(`https://api-test.bebop.xyz/jam/polygon/v1/order-status`);
	for (const query of Object.entries(req.query)) {
		requestURI.searchParams.append(query[0], query[1] as string);
	}

	const auth = {
		username: `dump`,
		password: String(process.env.BEBOP_JAM_KEY)
	};

	try {
		const {data} = (await axios.get(requestURI.toString(), {auth})) as {data: TBebopJamOrderStatusAPIResp};
		res.status(200).json(data);
	} catch (error) {
		res.status(500).json({error});
	}
}

export default JamProxyOrderStatus;
