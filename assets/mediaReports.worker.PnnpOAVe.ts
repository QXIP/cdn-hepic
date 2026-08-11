import moment from 'moment';

import type { CallCDRData } from '@/helpers/timeline-utils';
import { calculateTimelineData } from '@/helpers/timeline-utils';
import { SRTCP_METRIC_PLACEHOLDER, SRTCP_SOURCE, isSrtcpReport } from '@/helpers/srtcp';
import { mediaReportTypeItem } from '@/helpers/protocol-descriptor';

const getAliasByIp = (ip: any, withPort = false, alias: any = null) => {
    if (!alias) {
        return null;
    }

    const isIPv4 = ip.match(/^\d+\.\d+\.\d+\.\d+(\:\d+)?$/g) !== null;
    let PORT = isIPv4
        ? ip
              ?.match(/\:\d+/g)
              ?.find((j: any) => !!j)
              ?.split(':')[1] * 1 || 0
        : 0;
    let IP = isIPv4 ? ip?.match(/^\d+\.\d+\.\d+\.\d+/g)?.find((j: any) => !!j) : ip;
    let IP_PORT = `${IP}:${PORT}`;
    if (!isIPv4) {
        PORT = ip.split(/\:/g).pop() * 1;
        IP = ip
            .split(/\:\d+$/g)
            .shift()
            .replace(/\[|\]/g, '');
        IP_PORT = `[${IP}]:${PORT}`;
    }
    const ip_al = alias[IP_PORT] || alias[IP + ':0'] || IP;
    return withPort ? `${ip_al}:${PORT}` : ip_al;
};

const formattedData = (dataItem: any[], alias: any = null) => {
    return dataItem.map((sourceItem: any, key: number) => {
        const item: any = { ...sourceItem };
        const t = moment(sourceItem.start_ts);
        item.id = key + 1;
        item.date = t.format('DD-MM-YYYY');
        item.time = t.format('HH:mm:ss.SSS');
        item.reporter = sourceItem.reportname || 'RTPAGENT';
        item.type =
            `${sourceItem.type || sourceItem.typeItem || 'RTP'}` +
            ((sourceItem?.QOS?.qosTYPEless && ` [${sourceItem.QOS.qosTYPEless}]`) || '');
        item['Src IP'] = getAliasByIp(sourceItem.source_ip, false, alias) || sourceItem.source_ip;
        item['Dest IP'] =
            getAliasByIp(sourceItem.destination_ip, false, alias) || sourceItem.destination_ip;
        item['Src Port'] = sourceItem.source_port;
        item['Dest Port'] = sourceItem.destination_port;
        // Encrypted streams have no MOS; say so rather than leaving a blank
        // cell that reads as missing data (#462)
        const isSrtcpRow =
            sourceItem.QOS?.qosTYPE === SRTCP_SOURCE ||
            sourceItem.typeItem === SRTCP_SOURCE ||
            sourceItem.type === SRTCP_SOURCE;
        item.mos = isSrtcpRow ? SRTCP_METRIC_PLACEHOLDER : sourceItem.QOS?.MOS || '';
        return item;
    });
};

function transformQOSData(data: any): any {
    if (!data?.data) return data;

    if (data.messages || data.data.messages) {
        return data;
    }

    if (data.data.reports && Array.isArray(data.data.reports)) {
        const messages = data.data.reports
            .map((report: any, index: number) => {
                try {
                    const parsedMessage =
                        typeof report.message === 'string'
                            ? JSON.parse(report.message)
                            : report.message;

                    const typeItem = mediaReportTypeItem(report.proto, parsedMessage);

                    const messageObj = {
                        MEAN_MOS: parsedMessage.MEAN_MOS || parsedMessage.MOS || 0,
                        MOS: parsedMessage.MOS || parsedMessage.MEAN_MOS || 0,
                        MEAN_JITTER: parsedMessage.MEAN_JITTER || 0,
                        MEAN_INTERARRIVAL_JITTER: parsedMessage.JITTER || 0,
                        MAX_JITTER: parsedMessage.MAX_JITTER || 0,
                        CUM_PACKET_LOSS: parsedMessage.PACKET_LOSS || 0,
                        PACKET_LOSS: parsedMessage.PACKET_LOSS || 0,
                        FRACTION_LOSS: parsedMessage.FRACTION_LOSS || 0,
                        DELTA: parsedMessage.DELTA || 0,
                        SKEW: parsedMessage.SKEW || 0,
                        TOTAL_PACKETS:
                            parsedMessage.TOTAL_PK || parsedMessage.EXPECTED_PK || 0,
                        TOTAL_PK: parsedMessage.TOTAL_PK || 0,
                        EXPECTED_PK: parsedMessage.EXPECTED_PK || 0,
                        TOTAL_BYTES: parsedMessage.TL_BYTE || 0,
                        OCTET_COUNT: parsedMessage.OCTET_COUNT || 0,
                        BYTES: parsedMessage.BYTES || 0,
                        TL_BYTE: parsedMessage.TL_BYTE || 0,
                        TYPE: parsedMessage.TYPE || 'PERIODIC',
                        SSRC: parsedMessage.SSRC || 0,
                        SSRC_CHG: parsedMessage.SSRC_CHG || 0,
                        CODEC_NAME: parsedMessage.CODEC_NAME || '',
                        CODEC_PT: parsedMessage.CODEC_PT || 0,
                        CODEC_CH: parsedMessage.CODEC_CH || 0,
                        CLOCK: parsedMessage.CLOCK || 0,
                        RFACTOR: parsedMessage.RFACTOR || 0,
                        MIN_MOS: parsedMessage.MIN_MOS || parsedMessage.MOS || 0,
                        MIN_RFACTOR:
                            parsedMessage.MIN_RFACTOR || parsedMessage.RFACTOR || 0,
                        MEAN_RFACTOR:
                            parsedMessage.MEAN_RFACTOR || parsedMessage.RFACTOR || 0,
                        PKT_TYPE: parsedMessage.PKT_TYPE || parsedMessage.RTCP_TYPE || 0,
                        SOURCE: parsedMessage.SOURCE || '',
                        ...parsedMessage,
                    };

                    return {
                        ...report,
                        id: index + 1,
                        start_ts: report.create_ts || report.start_ts,
                        typeItem,
                        QOS: {
                            message: messageObj,
                            qosTYPE: parsedMessage.TYPE || 'PERIODIC',
                            qosTYPEless: (parsedMessage.TYPE || 'P')[0],
                            tabType: 'NetworkReport',
                            MOS: parsedMessage.MEAN_MOS || parsedMessage.MOS || 0,
                        },
                        source_data: {
                            QOS: {
                                message: messageObj,
                                qosTYPE: parsedMessage.TYPE || 'PERIODIC',
                                qosTYPEless: (parsedMessage.TYPE || 'P')[0],
                                tabType: 'NetworkReport',
                                MOS: parsedMessage.MEAN_MOS || parsedMessage.MOS || 0,
                            },
                            raw:
                                typeof report.message === 'string'
                                    ? report.message
                                    : JSON.stringify(report.message, null, 2),
                            data: report.data,
                        },
                        messageData: {
                            srcAlias:
                                report.alias_src || `${report.source_ip}:${report.source_port}`,
                            dstAlias:
                                report.alias_dst ||
                                `${report.destination_ip}:${report.destination_port}`,
                            diff: '0.000',
                        },
                    };
                } catch {
                    return null;
                }
            })
            .filter(Boolean);

        let cdrData: CallCDRData | undefined;

        if (data.data.calldata || data.data.call) {
            const callInfo = data.data.calldata || data.data.call;
            const calls = Array.isArray(callInfo) ? callInfo : [callInfo];

            const cdrConnectTimes = calls
                .map((c: any) => c.cdr_connect || c.connect_time || c.setup_time)
                .filter((t: number) => t && t > 0);
            const cdrStopTimes = calls
                .map((c: any) => c.cdr_stop || c.disconnect_time || c.end_time)
                .filter((t: number) => t && t > 0);

            if (cdrConnectTimes.length > 0 && cdrStopTimes.length > 0) {
                cdrData = {
                    cdr_connect: Math.min(...cdrConnectTimes),
                    cdr_stop: Math.max(...cdrStopTimes),
                };
            }
        }

        if (!cdrData && messages.length > 0) {
            const reportStarts = messages
                .map((m: any) => m.dateTime?.REPORT_START || m.QOS?.dateTime?.REPORT_START)
                .filter((t: number) => t && t > 0);
            const reportEnds = messages
                .map((m: any) => m.dateTime?.REPORT_END || m.QOS?.dateTime?.REPORT_END)
                .filter((t: number) => t && t > 0);

            if (reportStarts.length > 0 && reportEnds.length > 0) {
                cdrData = {
                    cdr_connect: Math.min(...reportStarts),
                    cdr_stop: Math.max(...reportEnds),
                };
            }
        }

        const timelineData = calculateTimelineData(messages, cdrData);

        return {
            ...data,
            messages,
            timelineData,
            cdrData,
            data: {
                ...data.data,
                messages,
            },
        };
    }

    return data;
}

export function processMediaReportsData(input: any) {
    const dataItem = transformQOSData(input);
    const alias = dataItem?.data?.alias;
    const messages = Array.isArray(dataItem?.messages) ? dataItem.messages : [];

    const networkReports = messages.filter(
        (item: any) => item?.QOS && item?.QOS?.tabType === 'NetworkReport'
    );
    const uaReports = messages.filter(
        (item: any) => item?.QOS && item?.QOS?.tabType === 'UAReport'
    );

    return {
        dataItem,
        networkReportData: formattedData(networkReports, alias),
        uaReportData: formattedData(uaReports, alias),
    };
}
