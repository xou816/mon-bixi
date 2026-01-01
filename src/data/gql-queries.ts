export type Data<T> = {
    data: T;
};

export type MemberWithStats = {
    stats: { numberOfRides: number; };
};

export type Location = {
    lat: number,
    lon: number
}

export type Ride = {
    rideId: string,
    startTimeMs: string,
    endTimeMs: string,
    startAddressStr: string,
    endAddressStr: string,
    startAddress: Location,
    endAddress: Location
}

export type MemberWithRides = {
    rideHistory: {
        hasMore: boolean
        rideHistoryList: Array<Ride>
    }
}

function fetchGql(query: unknown) {
    return fetch("https://secure.bixi.com/bikesharefe-gql", {
        "credentials": "include",
        "headers": {
            "content-type": "application/json",
        },
        "referrer": "https://secure.bixi.com/",
        "body": JSON.stringify(query),
        "method": "POST",
        "mode": "cors"
    });
}

export async function queryStats(): Promise<Data<{ member: MemberWithStats; }>> {
    const statsQuery = {
        operationName: "GlobalStats",
        variables: { memberId: null },
        query: `
            query GlobalStats($memberId: String) {
                member(id: $memberId) {
                    stats { 
                        numberOfRides
                    }
                }
            }`
    };
    const response = await fetchGql(queryHistory)
    return response.json();
}

export async function queryHistory(offset: number): Promise<Data<{ member: MemberWithRides }>> {
    const historyQuery = (offset: number) => ({
        operationName: "GetCurrentUserRides",
        variables: { startTimeMs: offset.toString() },
        query: `
            query GetCurrentUserRides($startTimeMs: String, $memberId: String) {
                member(id: $memberId) {
                    rideHistory(startTimeMs: $startTimeMs) {
                        hasMore
                        rideHistoryList {
                            rideId
                            startTimeMs
                            endTimeMs
                            startAddressStr
                            startAddress {
                                lon: lat
                                lat: lng
                            }
                            endAddressStr
                            endAddress {
                                lon: lat
                                lat: lng
                            }
                        }
                    }
                }
            }`
    })
    const response = await fetchGql(historyQuery(offset))
    return response.json();
}