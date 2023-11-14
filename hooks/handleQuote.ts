/* eslint-disable @typescript-eslint/consistent-type-assertions */
import {VALID_TO_MN, VALID_TO_MN_SAFE} from 'utils/constants';
import {TPossibleStatus} from 'utils/types';
import axios from 'axios';
import {
	EcdsaSigningScheme,
	OrderBookApi,
	OrderQuoteSideKindSell,
	OrderSigningUtils,
	SigningScheme
} from '@cowprotocol/cow-sdk';
import {signTypedData} from '@wagmi/core';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getEthersSigner} from '@yearn-finance/web-lib/utils/wagmi/ethersAdapter';

import {getTypedBebopQuote, getTypedCowswapQuote, hasQuote, isBebopOrder, isCowswapOrder} from './assertSolver';

import type {
	Maybe,
	TBebopJamQuoteAPIResp,
	TBebopOrderQuoteError,
	TBebopOrderQuoteResponse,
	TBebopRequest,
	TCowQuoteError,
	TCowswapOrderQuoteResponse,
	TCowswapRequest,
	TGetQuote,
	TQuote,
	TRequest,
	TRequestArgs,
	TRetreiveBebopQuote,
	TRetreiveCowQuote,
	TSignQuoteFromCowswap,
	TTokenWithAmount
} from 'utils/types';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import type {OrderParameters, OrderQuoteRequest, SigningResult, UnsignedOrder} from '@cowprotocol/cow-sdk';

/* 🥟 - Dump Services **********************************************************
 ** refreshQuote will simulate a click on the refresh button of a quote.
 ** This hack is used to trigger a specific action on a button out of the current
 ** state or context, allowing us to bypass the dom tree.
 ******************************************************************************/
export function refreshQuote(key: TAddress): void {
	setTimeout((): void => {
		document?.getElementById(`quote-refresh-${key}`)?.click();
	}, 10);
}

/* 🥟 - Dump Services **********************************************************
 ** resetQuote will simulate a click on the reset button of a quote.
 ** This hack is used to trigger a specific action on a button out of the current
 ** state or context, allowing us to bypass the dom tree.
 ******************************************************************************/
export function resetQuote(key: TAddress): void {
	setTimeout((): void => {
		document?.getElementById(`quote-reset-${key}`)?.click();
	}, 10);
}

/* 🥟 - Dump Services **********************************************************
 ** initQuote will add a quote to the current state of quotes, but this quote
 ** will be empty, except from a status of 'pending'.
 ******************************************************************************/
export function initQuote(prev: TQuote, key: TAddress, args: TRequestArgs, solver: 'COWSWAP' | 'BEBOP'): TQuote {
	if (solver === 'COWSWAP') {
		if (!prev) {
			return {
				solverType: 'COWSWAP',
				buyToken: {
					address: args.outputToken.address,
					decimals: args.outputToken.decimals,
					symbol: args.outputToken.symbol,
					name: args.outputToken.name,
					chainId: args.outputToken.chainId
				},
				sellTokens: {
					[args.inputTokens[0].address]: {
						address: args.inputTokens[0].address,
						decimals: args.inputTokens[0].decimals,
						symbol: args.inputTokens[0].symbol,
						name: args.inputTokens[0].name,
						chainId: args.inputTokens[0].chainId,
						amount: toNormalizedBN(0)
					}
				},
				quote: {
					[toAddress(key)]: {
						isFetching: true,
						sellToken: {
							chainId: args.inputTokens[0].chainId,
							address: args.inputTokens[0].address,
							decimals: args.inputTokens[0].decimals,
							symbol: args.inputTokens[0].symbol,
							name: args.inputTokens[0].name,
							amount: toNormalizedBN(0)
						},
						buyToken: {
							chainId: args.outputToken.chainId,
							address: args.outputToken.address,
							decimals: args.outputToken.decimals,
							symbol: args.outputToken.symbol,
							name: args.outputToken.name,
							amount: toNormalizedBN(0)
						},
						quote: {} as OrderParameters,
						expiration: '',
						expirationTimestamp: 0,
						validTo: 0,
						signature: '',
						orderUID: '',
						orderStatus: TPossibleStatus.NOT_STARTED,
						orderError: undefined,
						isRefreshing: false,
						signingScheme: EcdsaSigningScheme.ETHSIGN
					}
				}
			} as TRequest & TCowswapRequest;
		}

		const prevQuote = getTypedCowswapQuote(prev);
		return {
			...prevQuote,
			quote: {
				...prevQuote.quote,
				[toAddress(key)]: {
					...prevQuote.quote[toAddress(key)],
					sellToken: prevQuote.quote[toAddress(key)]?.sellToken || {
						address: args.inputTokens[0].address,
						decimals: args.inputTokens[0].decimals,
						symbol: args.inputTokens[0].symbol,
						name: args.inputTokens[0].name,
						amount: toNormalizedBN(0)
					},
					buyToken: prevQuote.quote[toAddress(key)]?.buyToken || {
						address: args.outputToken.address,
						decimals: args.outputToken.decimals,
						symbol: args.outputToken.symbol,
						name: args.outputToken.name,
						amount: toNormalizedBN(0)
					},
					isFetching: true
				}
			}
		};
	}

	if (solver === 'BEBOP') {
		if (!prev) {
			return {
				solverType: 'BEBOP',
				buyTokens: {
					[args.inputTokens[0].address]: {
						address: args.outputToken.address,
						decimals: args.outputToken.decimals,
						symbol: args.outputToken.symbol,
						name: args.outputToken.name,
						chainId: args.outputToken.chainId
					}
				},
				sellTokens: {
					[args.inputTokens[0].address]: {
						address: args.inputTokens[0].address,
						decimals: args.inputTokens[0].decimals,
						symbol: args.inputTokens[0].symbol,
						name: args.inputTokens[0].name,
						chainId: args.inputTokens[0].chainId,
						amount: toNormalizedBN(0)
					}
				},
				quote: {
					isFetching: true,
					isRefreshing: false,
					sellToken: {
						chainId: args.inputTokens[0].chainId,
						address: args.inputTokens[0].address,
						decimals: args.inputTokens[0].decimals,
						symbol: args.inputTokens[0].symbol,
						name: args.inputTokens[0].name,
						amount: toNormalizedBN(0)
					},
					buyToken: {
						chainId: args.outputToken.chainId,
						address: args.outputToken.address,
						decimals: args.outputToken.decimals,
						symbol: args.outputToken.symbol,
						name: args.outputToken.name,
						amount: toNormalizedBN(0)
					},
					id: '',
					status: '',
					signature: '',
					type: '',
					chainId: 0,
					receiver: args.receiver,
					from: args.from,
					expirationTimestamp: 0,
					toSign: {} as unknown,
					orderUID: '',
					orderStatus: TPossibleStatus.NOT_STARTED,
					orderError: undefined
				}
			} as TRequest & TBebopRequest;
		}

		const prevQuote = getTypedBebopQuote(prev);
		return {
			...prevQuote,
			lastUpdate: new Date(),
			quote: {
				...prevQuote.quote,
				sellToken: prevQuote.quote?.sellToken || {
					address: args.inputTokens[0].address,
					decimals: args.inputTokens[0].decimals,
					symbol: args.inputTokens[0].symbol,
					name: args.inputTokens[0].name,
					amount: toNormalizedBN(0)
				},
				buyToken: prevQuote.quote?.buyToken || {
					address: args.outputToken.address,
					decimals: args.outputToken.decimals,
					symbol: args.outputToken.symbol,
					name: args.outputToken.name,
					amount: toNormalizedBN(0)
				},
				isFetching: true
			}
		};
	}

	return prev;
}

/* 🥟 - Dump Services **********************************************************
 ** addQuote will add a quote to the current state of quotes, by updating the
 ** quote and sellTokens objects with the one provided.
 ******************************************************************************/
export function addQuote(prev: Maybe<TQuote>, quote: TQuote): TQuote {
	if (!prev) {
		return quote;
	}

	if (isCowswapOrder(prev) && isCowswapOrder(quote)) {
		const prevQuote = getTypedCowswapQuote(prev).quote;
		const newQuote = getTypedCowswapQuote(quote).quote;
		for (const [key, item] of Object.entries(newQuote)) {
			prevQuote[toAddress(key)] = item;
		}
		const updatedSellTokens: TDict<TTokenWithAmount> = prev.sellTokens;
		const newSellTokens: TDict<TTokenWithAmount> = quote.sellTokens;
		for (const [key, item] of Object.entries(newSellTokens)) {
			updatedSellTokens[toAddress(key)] = item;
		}

		return {
			...prev,
			quote: prevQuote,
			sellTokens: updatedSellTokens
		};
	}

	if (isBebopOrder(prev) && isBebopOrder(quote)) {
		const newQuote = getTypedBebopQuote(quote);
		if (newQuote.lastUpdate < prev.lastUpdate) {
			return prev;
		}
		return newQuote;
	}

	return quote;
}

/* 🥟 - Dump Services **********************************************************
 ** deleteQuote will remove a quote from the current state of quotes, by removing
 ** them from the quote and sellTokens objects.
 ******************************************************************************/
export function deleteQuote(quotes: TQuote, key: TAddress): TQuote {
	if (isCowswapOrder(quotes)) {
		const currentQuote = getTypedCowswapQuote(quotes);
		const quoteItems = {...currentQuote.quote};
		const sellTokens = {...currentQuote.sellTokens};
		delete quoteItems[toAddress(key)];
		delete sellTokens[toAddress(key)];
		return {
			...currentQuote,
			quote: quoteItems,
			sellTokens
		};
	}

	if (isBebopOrder(quotes)) {
		const currentQuote = getTypedBebopQuote(quotes);
		const sellTokens = {...currentQuote.sellTokens};
		delete sellTokens[toAddress(key)];
		return {
			...currentQuote,
			quote: {} as TBebopOrderQuoteResponse,
			sellTokens: sellTokens
		};
	}

	return quotes;
}

/* 🥟 - Dump Services **********************************************************
 ** assignSignature will add a signature to the current state of a given quote.
 ******************************************************************************/
export function assignSignature(
	quotes: TQuote,
	key: TAddress,
	signature: string,
	signingScheme: EcdsaSigningScheme
): TQuote {
	if (isCowswapOrder(quotes)) {
		const currentQuote = getTypedCowswapQuote(quotes);
		const quoteItems = {...currentQuote.quote};
		quoteItems[toAddress(key)].signature = signature;
		quoteItems[toAddress(key)].signingScheme = signingScheme;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}

	if (isBebopOrder(quotes)) {
		const currentQuote = getTypedBebopQuote(quotes);
		const quoteItems = currentQuote.quote;
		quoteItems.signature = signature;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}

	return quotes;
}

/* 🥟 - Dump Services **********************************************************
 ** setPendingQuote will set a quote as pending, by updating the order status
 ** and the orderUID.
 ******************************************************************************/
export function setPendingQuote(quotes: TQuote, key: TAddress, orderUID: string): TQuote {
	if (isCowswapOrder(quotes)) {
		const currentQuote = getTypedCowswapQuote(quotes);
		const quoteItems = {...currentQuote.quote};
		quoteItems[toAddress(key)].orderUID = orderUID;
		quoteItems[toAddress(key)].orderStatus = TPossibleStatus.PENDING;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}

	if (isBebopOrder(quotes)) {
		const currentQuote = getTypedBebopQuote(quotes);
		const quoteItems = currentQuote.quote;
		quoteItems.orderUID = orderUID;
		quoteItems.orderStatus = TPossibleStatus.PENDING;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}

	return quotes;
}

/* 🥟 - Dump Services **********************************************************
 ** setRefreshingQuote will set a quote as refreshing, by updating isRefreshing
 ******************************************************************************/
export function setRefreshingQuote(quotes: TQuote, key: TAddress): TQuote {
	if (isCowswapOrder(quotes)) {
		const currentQuote = getTypedCowswapQuote(quotes);
		const quoteItems = {...currentQuote.quote};
		quoteItems[toAddress(key)].isRefreshing = true;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}

	if (isBebopOrder(quotes)) {
		const currentQuote = getTypedBebopQuote(quotes);
		const quoteItems = currentQuote.quote;
		quoteItems.isRefreshing = true;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}

	return quotes;
}

/* 🥟 - Dump Services **********************************************************
 ** setInvalidQuote will set a quote as invalid, by updating the order status
 ** and the orderUID.
 ******************************************************************************/
export function setInvalidQuote(quotes: TQuote, key: TAddress, orderUID: string): TQuote {
	if (isCowswapOrder(quotes)) {
		const currentQuote = getTypedCowswapQuote(quotes);
		const quoteItems = {...currentQuote.quote};
		quoteItems[toAddress(key)].orderUID = orderUID;
		quoteItems[toAddress(key)].orderStatus = TPossibleStatus.INVALID;
		quoteItems[toAddress(key)].expirationTimestamp = 0;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}

	if (isBebopOrder(quotes)) {
		const currentQuote = getTypedBebopQuote(quotes);
		const quoteItems = {...currentQuote.quote};
		quoteItems.orderUID = orderUID;
		quoteItems.orderStatus = TPossibleStatus.INVALID;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}
	return quotes;
}

/* 🥟 - Dump Services **********************************************************
 ** setStatusQuote will set a quote as "status", by updating the order status
 ** and the orderUID.
 ******************************************************************************/
export function setStatusQuote(quotes: TQuote, key: TAddress, status: TPossibleStatus, orderUID: string): TQuote {
	if (isCowswapOrder(quotes)) {
		const currentQuote = getTypedCowswapQuote(quotes);
		const quoteItems = {...currentQuote.quote};
		quoteItems[toAddress(key)].orderUID = orderUID;
		quoteItems[toAddress(key)].orderStatus = status;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}

	if (isBebopOrder(quotes)) {
		const currentQuote = getTypedBebopQuote(quotes);
		const quoteItems = currentQuote.quote;
		quoteItems.orderUID = orderUID;
		quoteItems.orderStatus = TPossibleStatus.INVALID;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}

	return quotes;
}
/* 🥟 - Dump Services **********************************************************
 ** getBuyAmount will return the buy amount of a quote for a given token address.
 ** If the quote does not exist, it will return a normalized big number of 0.
 ** If the quote is a Cowswap order, it will return the buy token amount.
 ** If the quote is a Bebop order, it will return the buy token amount.
 ******************************************************************************/
export function getBuyAmount(quotes: TRequest, tokenAddress: TAddress): TNormalizedBN {
	if (!hasQuote(quotes, tokenAddress)) {
		return toNormalizedBN(0);
	}

	if (isCowswapOrder(quotes)) {
		const currentQuote = getTypedCowswapQuote(quotes);
		return currentQuote.quote[toAddress(tokenAddress)].buyToken.amount;
	}

	if (isBebopOrder(quotes)) {
		const currentQuote = getTypedBebopQuote(quotes);
		return currentQuote.buyTokens[tokenAddress].amount;
	}
	return toNormalizedBN(0);
}

/* 🥟 - Dump Services **********************************************************
 ** getSellAmount will return the sell amount of a quote for a given token address.
 ** If the quote does not exist, it will return a normalized big number of 0.
 ** If the quote is a Cowswap order, it will return the sell amount plus the fee amount.
 ** If the quote is a Bebop order, it will return the raw sell token amount.
 ******************************************************************************/
export function getSellAmount(quotes: TRequest, tokenAddress: TAddress): TNormalizedBN {
	if (!hasQuote(quotes, tokenAddress)) {
		return toNormalizedBN(0);
	}

	if (isCowswapOrder(quotes)) {
		const currentQuote = getTypedCowswapQuote(quotes);
		return toNormalizedBN(
			toBigInt(currentQuote.quote[toAddress(tokenAddress)]?.quote?.sellAmount) +
				toBigInt(currentQuote.quote[toAddress(tokenAddress)]?.quote?.feeAmount),
			currentQuote.quote[toAddress(tokenAddress)].sellToken.decimals
		);
	}

	if (isBebopOrder(quotes)) {
		const currentQuote = getTypedBebopQuote(quotes);
		return toNormalizedBN(
			toBigInt(currentQuote.sellTokens[toAddress(tokenAddress)]?.amount?.raw),
			currentQuote.sellTokens[toAddress(tokenAddress)]?.decimals || 18
		);
	}
	return toNormalizedBN(0);
}

/* 🥟 - Dump Services **********************************************************
 ** The function retrieveQuoteFromCowswap is an asynchronous function that
 ** retrieves a quote from Cowswap. It takes an object as an argument which
 ** includes the request, sellToken, buyToken, from, receiver, amount, and
 ** isWalletSafe. It returns a Promise of type TGetQuote.
 ******************************************************************************/
async function retrieveQuoteFromCowswap({
	request,
	sellToken,
	buyToken,
	from,
	receiver,
	amount,
	isWalletSafe
}: TRetreiveCowQuote & {request: TRequestArgs}): Promise<TGetQuote> {
	const cowswapOrderBook = new OrderBookApi({chainId: 1});
	const quote: OrderQuoteRequest = {
		sellToken, // token to spend
		buyToken: buyToken.address, // token to receive
		from,
		receiver,
		appData: process.env.COWSWAP_APP_DATA || '',
		partiallyFillable: false, // always false
		kind: OrderQuoteSideKindSell.SELL,
		validTo: 0,
		sellAmountBeforeFee: toBigInt(amount.raw || 0).toString(), // amount to sell, in wei
		signingScheme: isWalletSafe ? SigningScheme.PRESIGN : SigningScheme.EIP712
	};
	const canExecuteFetch =
		!(isZeroAddress(quote.from) || isZeroAddress(quote.sellToken) || isZeroAddress(quote.buyToken)) &&
		toBigInt(amount.raw || 0) > 0n;

	if (canExecuteFetch && cowswapOrderBook) {
		quote.validTo = Math.round(
			new Date().setMinutes(new Date().getMinutes() + (isWalletSafe ? VALID_TO_MN_SAFE : VALID_TO_MN)) / 1000
		);
		try {
			const result = (await cowswapOrderBook.getQuote(quote)) as TCowswapOrderQuoteResponse;
			const sellToken: TTokenWithAmount = {
				address: toAddress(request.inputTokens[0].address),
				name: request.inputTokens[0].name,
				symbol: request.inputTokens[0].symbol,
				decimals: request.inputTokens[0].decimals,
				chainId: request.inputTokens[0].chainId,
				amount: toNormalizedBN(
					toBigInt(result.quote.sellAmount) + toBigInt(result.quote.feeAmount),
					request.outputToken.decimals
				)
			};
			const buyTokenWithAmount: TTokenWithAmount = {
				...buyToken,
				amount: toNormalizedBN(result.quote.buyAmount, buyToken.decimals)
			};
			const cowRequest: TRequest & TCowswapRequest = {
				solverType: 'COWSWAP',
				buyToken: buyTokenWithAmount,
				sellTokens: {
					[request.inputTokens[0].address]: sellToken
				},
				quote: {
					[toAddress(result.quote.sellToken)]: {
						...result,
						quote: result.quote,
						buyToken: buyTokenWithAmount,
						sellToken: sellToken
					}
				}
			};
			return {quoteResponse: cowRequest};
		} catch (_error) {
			const error = _error as TCowQuoteError;
			error.solverType = 'COWSWAP';
			error.message = '[CowSwap] - Impossible to dump that token';
			error.shouldDisable = true;
			console.error(error);
			if (error.body.errorType === 'UnsupportedToken') {
				error.message = 'This token is not supported by CowSwap';
			}
			if (error.body.errorType === 'NoLiquidity') {
				error.message = 'There is no liquidity for this token';
			}
			if (error.body.errorType === 'SellAmountDoesNotCoverFee') {
				if (toBigInt(request.inputBalances[0]) >= toBigInt(error?.body?.data?.fee_amount)) {
					error.message = 'The sell amount does not cover the fee. You can try to increase the amount';
					error.shouldDisable = false;
				} else {
					error.message = 'The sell amount does not cover the fee';
				}
			}
			return {feeAmount: toBigInt(error?.body?.data?.fee_amount), error};
		}
	}
	return {feeAmount: 0n};
}
/* 🥟 - Dump Services **********************************************************
 ** The following function retrieveQuoteFromBebopJam is responsible for
 ** retrieving a quote from the Bebop Jam service. It takes in a request,
 ** sellTokens, buyToken, from, receiver, and amounts as parameters. It returns
 ** a Promise of type TGetQuote.
 ******************************************************************************/
async function retrieveQuoteFromBebopJam({
	request,
	sellTokens,
	buyToken,
	from,
	receiver,
	amounts
}: TRetreiveBebopQuote & {request: TRequestArgs}): Promise<TGetQuote> {
	const hasZeroAddressSellToken = sellTokens.some((token): boolean => isZeroAddress(token));
	const hasZeroAmount = amounts.some((amount): boolean => toBigInt(amount.raw || 0) <= 0n);
	const canExecuteFetch =
		!(isZeroAddress(from) || hasZeroAddressSellToken || isZeroAddress(buyToken.address)) && !hasZeroAmount;

	if (canExecuteFetch) {
		try {
			const requestURI = new URL(`http://${'localhost:3000'}/api/jamProxy`);
			requestURI.searchParams.append('buy_tokens', buyToken.address);
			requestURI.searchParams.append('sell_tokens', sellTokens.join(','));
			requestURI.searchParams.append('sell_amounts', amounts.map(({raw}): string => raw.toString()).join(','));
			requestURI.searchParams.append('taker_address', from);
			requestURI.searchParams.append('receiver_address', receiver);
			requestURI.searchParams.append('approval_type', 'Standard');
			requestURI.searchParams.append('source', 'smol');
			const {data} = await axios.get(requestURI.toString());

			if ((data as TBebopOrderQuoteError)?.error?.errorCode) {
				const error = data as TBebopOrderQuoteError;
				error.solverType = 'BEBOP';
				error.message = '[Bebop] - Impossible to dump that token - ' + error.error.message;
				console.error(error);
				return {feeAmount: 0n, error};
			}

			if (data.status === 'Success') {
				const apiResponse = data as TBebopJamQuoteAPIResp;
				const [[, originalBuyToken]] = Object.entries(apiResponse.buyTokens);
				const [[originalSellTokenAddr, originalSellToken]] = Object.entries(apiResponse.sellTokens);
				const requestedSellToken = request.outputToken;

				const result: TBebopOrderQuoteResponse = {
					id: apiResponse.quoteId,
					status: apiResponse.status,
					type: apiResponse.type,
					chainId: apiResponse.chainId,
					receiver: toAddress(apiResponse.receiver),
					from: from,
					expirationTimestamp: Number(apiResponse.expiry) - 20, //Bebop has a 20s grace period, but we cannot send order during it.
					toSign: apiResponse.toSign,
					buyToken: {
						address: toAddress(buyToken.address),
						decimals: originalBuyToken.decimals,
						name: buyToken.name || '',
						symbol: buyToken.symbol || '',
						chainId: buyToken.chainId || 0,
						amount: toNormalizedBN(originalBuyToken.amount, originalBuyToken.decimals)
					},
					sellToken: {
						address: toAddress(originalSellTokenAddr),
						decimals: originalSellToken.decimals,
						name: requestedSellToken.name,
						symbol: requestedSellToken.symbol,
						chainId: requestedSellToken.chainId,
						amount: toNormalizedBN(originalSellToken.amount, originalSellToken.decimals)
					},
					//Rest
					orderUID: '',
					orderStatus: TPossibleStatus.NOT_STARTED,
					orderError: undefined,
					isRefreshing: false,
					signature: '0x',
					isSigned: false,
					isSigning: false,
					hasSignatureError: false,
					isExecuted: false,
					isExecuting: false,
					hasExecutionError: false,
					txHash: '0x'
				};

				const sellTokens: TDict<TTokenWithAmount> = {};
				const buyTokens: TDict<TTokenWithAmount> = {};
				for (const [tokenAddress, tokenToSell] of Object.entries(apiResponse.sellTokens)) {
					const fromInputToken = request.inputTokens.find(
						(t): boolean => t.address === toAddress(tokenAddress)
					);
					sellTokens[toAddress(tokenAddress)] = {
						address: toAddress(tokenAddress),
						decimals: tokenToSell.decimals,
						name: fromInputToken?.name || '',
						symbol: fromInputToken?.symbol || '',
						chainId: fromInputToken?.chainId || 0,
						amount: toNormalizedBN(tokenToSell.amount, tokenToSell.decimals)
					};

					const estimatedOut = toNormalizedBN(
						Math.round(
							Number(
								Number(toNormalizedBN(tokenToSell.amount, tokenToSell.decimals).normalized) *
									(Number(tokenToSell.price) * Number(10 ** originalBuyToken.decimals))
							)
						),
						originalBuyToken.decimals
					);
					const estimatedOutBeforeFees = toNormalizedBN(
						Math.round(
							Number(
								Number(toNormalizedBN(tokenToSell.amount, tokenToSell.decimals).normalized) *
									(Number(tokenToSell.priceBeforeFee) * Number(10 ** originalBuyToken.decimals))
							)
						),
						originalBuyToken.decimals
					);
					buyTokens[toAddress(tokenAddress)] = {
						address: toAddress(buyToken.address),
						decimals: originalBuyToken.decimals,
						name: buyToken?.name || '',
						symbol: buyToken?.symbol || '',
						chainId: buyToken?.chainId || 0,
						amount: estimatedOut,
						amountWithSlippage: estimatedOutBeforeFees
					};
				}

				const bebopRequest: TRequest = {
					solverType: 'BEBOP',
					buyTokens: buyTokens,
					sellTokens: sellTokens,
					quote: result,
					lastUpdate: new Date()
				};

				return {quoteResponse: bebopRequest};
			}
		} catch (_error) {
			const error = _error as TBebopOrderQuoteError;
			error.solverType = 'BEBOP';
			error.message = '[Bebop] - Impossible to dump that token';
			console.error(_error);
			return {feeAmount: 0n, error};
		}
	}
	return {feeAmount: 0n};
}

/* 🥟 - Dump Services **********************************************************
 ** The following function retrieveQuote is responsible for retrieving a quote
 ** from the appropriate service. It takes in a chainID, request, and
 ** isWalletSafe as parameters. It returns a Promise of type TGetQuote.
 ******************************************************************************/
export async function retrieveQuote(props: {
	chainID: number;
	request: TRequestArgs;
	isWalletSafe: boolean;
}): Promise<TGetQuote> {
	switch (props.chainID) {
		case 1:
			if (props.request.inputAmounts.length === 1 && props.request.inputTokens.length === 1) {
				return await retrieveQuoteFromCowswap({
					request: props.request,
					sellToken: toAddress(props.request.inputTokens[0].address),
					buyToken: props.request.outputToken,
					from: toAddress(props.request.from),
					receiver: toAddress(props.request.receiver),
					amount: toNormalizedBN(props.request.inputAmounts[0], props.request.inputTokens[0].decimals),
					isWalletSafe: props.isWalletSafe
				});
			}
			return {quoteResponse: undefined, feeAmount: 0n, error: undefined};
		case 137:
			return await retrieveQuoteFromBebopJam({
				request: props.request,
				sellTokens: props.request.inputTokens.map(({address}): TAddress => toAddress(address)),
				buyToken: props.request.outputToken,
				from: toAddress(props.request.from),
				receiver: toAddress(props.request.receiver),
				amounts: props.request.inputAmounts.map(
					(value, index): TNormalizedBN => toNormalizedBN(value, props.request.inputTokens[index].decimals)
				),
				isWalletSafe: props.isWalletSafe
			});
		default:
			return {quoteResponse: undefined, feeAmount: 0n, error: undefined};
	}
}

/* 🥟 - Dump Services **********************************************************
 ** The following function signQuoteFromCowswap is responsible for signing a
 ** quote from the Cowswap service. It takes in a quoteOrder, safeChainID, and
 ** amountWithSlippage as parameters. It returns a Promise of type SigningResult.
 ** If the environment variable SHOULD_USE_PRESIGN is set, it simulates the signing
 ** process by sleeping for 1 second and returns a presign signature. Otherwise, it
 ** retrieves the signer for the given chain and signs the order using the
 ** OrderSigningUtils.signOrder function.
 ******************************************************************************/
export async function signQuoteFromCowswap({
	quoteOrder,
	safeChainID,
	amountWithSlippage
}: TSignQuoteFromCowswap): Promise<SigningResult> {
	if (process.env.SHOULD_USE_PRESIGN) {
		//sleep 1 second to simulate the signing process
		await new Promise(async (resolve): Promise<NodeJS.Timeout> => setTimeout(resolve, 1000));
		return {signature: '0x', signingScheme: 'presign'} as unknown as SigningResult;
	}

	const {quote} = quoteOrder;
	const buyAmountWithSlippage = quoteOrder.buyAmountWithSlippage || amountWithSlippage;
	const signer = await getEthersSigner({chainId: safeChainID});

	if (!signer) {
		console.error(`No signer found for chain ${safeChainID}`);
		return {signature: '0x', signingScheme: 'none'} as unknown as SigningResult;
	}

	return await OrderSigningUtils.signOrder(
		{...(quote as UnsignedOrder), buyAmount: buyAmountWithSlippage.toString()},
		safeChainID,
		signer
	);
}

/* 🥟 - Dump Services **********************************************************
 ** The following function signQuoteFromBebop is responsible for signing a
 ** quote from the Bebop service. It takes in a quote of type TBebopOrderQuoteResponse
 ** as a parameter. It returns a Promise of type SigningResult.
 **
 ** The function uses the signTypedData method to sign the quote. The primaryType
 ** is set to 'JamOrder'. The domain includes the name, version, chainId, and
 ** verifyingContract, which is set to the BEBOP_SETTLEMENT_ADDRESS environment
 ** variable.
 **
 ** The types object defines the structure of the JamOrder, including various
 ** properties such as taker, receiver, expiry, nonce, executor, minFillPercent,
 ** hooksHash, sellTokens, buyTokens, sellAmounts, buyAmounts, sellTokenTransfers,
 ** and buyTokenTransfers.
 **
 ** The message to be signed is the toSign property of the quote. The function
 ** then returns the signature and the signingScheme set to 'eip712'.
 ******************************************************************************/
export async function signQuoteFromBebop({quote}: {quote: TBebopOrderQuoteResponse}): Promise<SigningResult> {
	const signature = await signTypedData({
		primaryType: 'JamOrder',
		domain: {
			name: 'JamSettlement',
			version: '1',
			chainId: quote.chainId,
			verifyingContract: toAddress(process.env.BEBOP_SETTLEMENT_ADDRESS)
		},
		types: {
			JamOrder: [
				{name: 'taker', type: 'address'},
				{name: 'receiver', type: 'address'},
				{name: 'expiry', type: 'uint256'},
				{name: 'nonce', type: 'uint256'},
				{name: 'executor', type: 'address'},
				{name: 'minFillPercent', type: 'uint16'},
				{name: 'hooksHash', type: 'bytes32'},
				{name: 'sellTokens', type: 'address[]'},
				{name: 'buyTokens', type: 'address[]'},
				{name: 'sellAmounts', type: 'uint256[]'},
				{name: 'buyAmounts', type: 'uint256[]'},
				{name: 'sellNFTIds', type: 'uint256[]'},
				{name: 'buyNFTIds', type: 'uint256[]'},
				{name: 'sellTokenTransfers', type: 'bytes'},
				{name: 'buyTokenTransfers', type: 'bytes'}
			]
		},
		message: quote.toSign
	});
	return {signature, signingScheme: 'eip712' as EcdsaSigningScheme};
}
