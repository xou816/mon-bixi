export async function queryStats(): Promise<Data<{ member: Member; }>> {
    const statsQuery = {
        "operationName": "GlobalStats",
        "variables": { "memberId": null },
        "query": `query GlobalStats($memberId: String) {
                member(id: $memberId) {
                    stats { 
                        numberOfRides
                    }
                }
            }`
    };
    const response = await fetch("https://secure.bixi.com/bikesharefe-gql", {
        "credentials": "include",
        "headers": {
            "content-type": "application/json",
        },
        "referrer": "https://secure.bixi.com/ride-history",
        "body": JSON.stringify(statsQuery),
        "method": "POST",
        "mode": "cors"
    });
    return await response.json();
} 

export type Data<T> = {
    data: T;
};

export type Member = {
    stats: { numberOfRides: number; };
};

