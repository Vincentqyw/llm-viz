'use client';
import { faGithub, faTwitter } from '@fortawesome/free-brands-svg-icons';
import { faCircleDollarToSlot, faEnvelope, faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import s from './HomePage.module.scss';
import { Tooltip } from '../utils/Tooltip';

export const HomePage: React.FC = () => {
    let [emailText, setEmailText] = useState('');
    let router = useRouter();

    function showEmail(ev: React.MouseEvent) {
        let last = 'bycroft';
        let first = 'brendan';
        let domain = 'moc.liamg';
        domain = [...domain].reverse().join('');
        let at = '_' + 'at' + '_';
        setEmailText(text => text ? '' : `${first}.${last} ${at} ${domain}`);
        ev.stopPropagation();
        ev.preventDefault();
    }

    function externalIcon() {
        return <FontAwesomeIcon icon={faUpRightFromSquare} fontSize={10} className='ml-3 mr-1 relative top-[-1px]' />;
    }

    return <div className={s.homePage}>


        <div className={s.projectsSection}>
            <div className={s.sectionTitle}>Projects</div>
            <div className={s.projectCard} onClick={() => router.push('/llm')}>
                <div className={s.cardImageWrapper}>
                    <div className={s.cardImage}>
                        <img src="/images/llm-viz-screenshot2.png" alt="LLM Visualization Screenshot" />
                    </div>
                </div>
                <div className={s.cardContent}>
                    <div className={s.cardTitle}>
                        <Link href={"/llm"}>
                        {/* rel="noopener noreferrer" target="_blank"> */}
                            LLM Visualization
                        </Link>
                    </div>
                    <div className={s.cardText}>
                        A visualization and walkthrough of the LLM algorithm that backs OpenAI's ChatGPT.
                        Explore the algorithm down to every add & multiply, seeing the whole process in action.
                    </div>
                </div>
            </div>
        </div>
    </div>;
}
