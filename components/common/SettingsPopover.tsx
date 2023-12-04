import {Fragment} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {Popover, Transition} from '@headlessui/react';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {IconSettings} from '@yearn-finance/web-lib/icons/IconSettings';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';

import type {ReactElement} from 'react';

export default function SettingsPopover(): ReactElement {
	const {slippage} = useSweepooor();

	return (
		<Popover className={'relative flex'}>
			{({close}): ReactElement => (
				<>
					<Popover.Button>
						<span className={'sr-only'}>{'Settings'}</span>
						<IconSettings className={'transition-color h-4 w-4 text-neutral-400 hover:text-neutral-900'} />
					</Popover.Button>
					<Transition
						as={Fragment}
						enter={'transition ease-out duration-200'}
						enterFrom={'opacity-0 translate-y-1'}
						enterTo={'opacity-100 translate-y-0'}
						leave={'transition ease-in duration-150'}
						leaveFrom={'opacity-100 translate-y-0'}
						leaveTo={'opacity-0 translate-y-1'}>
						<Popover.Panel
							className={
								'absolute right-0 top-6 z-[1000] mt-3 w-screen max-w-[260px] md:-right-4 md:top-4'
							}>
							<div className={'rounded border border-neutral-300 bg-neutral-0 p-4'}>
								<div className={'relative'}>
									<div>
										<label
											htmlFor={'slippageTolerance'}
											className={'block pb-2 font-bold text-neutral-900'}>
											{'Slippage tolerance'}
										</label>
										<div className={'mt-1 flex flex-col space-y-4'}>
											<div className={'flex flex-row space-x-2'}>
												<button
													onClick={(): void => slippage.set(10n)}
													className={`flex h-8 items-center rounded border-2 bg-neutral-100 px-1.5 py-2 ${
														slippage.value === 10n
															? 'border-purple-300'
															: 'border-transparent'
													}`}>
													<p className={'font-number pr-4 text-neutral-900'}>{'0.1%'}</p>
												</button>
												<button
													onClick={(): void => slippage.set(30n)}
													className={`flex h-8 items-center rounded border-2 bg-neutral-100 px-1.5 py-2 ${
														slippage.value === 30n
															? 'border-purple-300'
															: 'border-transparent'
													}`}>
													<p className={'font-number pr-4'}>{'0.3%'}</p>
												</button>
												<button
													onClick={(): void => slippage.set(50n)}
													className={`flex h-8 items-center rounded border-2 bg-neutral-100 px-1.5 py-2 ${
														slippage.value === 50n
															? 'border-purple-300'
															: 'border-transparent'
													}`}>
													<p className={'font-number pr-4'}>{'0.5%'}</p>
												</button>
											</div>

											<div>
												<div className={'fond-medium text-xs text-neutral-700'}>{'Custom'}</div>
												<div
													className={`md:min-w-72 flex h-8 w-full min-w-[48px] items-center rounded border-2 bg-neutral-100 px-0 py-4 ${
														slippage.value !== 10n &&
														slippage.value !== 30n &&
														slippage.value !== 50n
															? 'border-purple-300'
															: 'border-transparent'
													}`}>
													<input
														id={'slippageTolerance'}
														type={'number'}
														min={0}
														step={1}
														max={100}
														className={
															'font-number h-10 w-full overflow-x-scroll border-none bg-transparent p-2 text-right outline-none scrollbar-none'
														}
														value={(Number(slippage.value) / 100).toString()}
														onChange={(e): void => {
															if (e.target.valueAsNumber > 100) {
																return slippage.set(10_000n);
															}
															const roundedValue = Math.round(
																e.target.valueAsNumber * 100
															);
															slippage.set(toBigInt(roundedValue));
														}}
													/>
													<p className={'font-number mt-1 pr-2 text-neutral-900/60'}>{'%'}</p>
												</div>
											</div>

											<div>
												<Button
													onClick={close}
													className={'h-8 w-full'}>
													{'Confirm'}
												</Button>
											</div>
										</div>
									</div>
								</div>
							</div>
						</Popover.Panel>
					</Transition>
				</>
			)}
		</Popover>
	);
}
