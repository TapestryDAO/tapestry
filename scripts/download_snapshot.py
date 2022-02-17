import requests
from requests import RequestException, Timeout
from tqdm import tqdm
from requests_toolbelt.utils import dump
import sys

DEFAULT_HEADERS = {"Content-Type": "application/json"}

def do_request(url_: str, method_: str = 'GET', data_: str = '', timeout_: int = 3,
               headers_: dict = None):
    r = ''
    if headers_ is None:
        headers_ = DEFAULT_HEADERS

    try:
        if method_.lower() == 'get':
            r = requests.get(url_, headers=headers_, timeout=(timeout_, timeout_))
        elif method_.lower() == 'post':
            r = requests.post(url_, headers=headers_, data=data_, timeout=(timeout_, timeout_))
        elif method_.lower() == 'head':
            r = requests.head(url_, headers=headers_, timeout=(timeout_, timeout_))
        # print(f'{r.content, r.status_code, r.text}')
        return r

    except (RequestException, Timeout, Exception) as reqErr:
        # print(f'error in do_request(): {reqErr}')
        return f'error in do_request(): {reqErr}'

def get_all_rpc_ips(rpc_address: str):
    print("get_all_rpc_ips()")
    d = '{"jsonrpc":"2.0", "id":1, "method":"getClusterNodes"}'
    r = do_request(url_=rpc_address, method_='post', data_=d)
    if 'result' in str(r.text):
        rpc_ips = [rpc["rpc"] for rpc in r.json()["result"] if rpc["rpc"] is not None]
        return rpc_ips

    else:
        sys.exit(f'Can\'t get RPC ip addresses {r.text}')

def download(url: str, fname: str):
    resp = requests.get(url, stream=True)
    total = int(resp.headers.get('content-length', 0))
    print("downloading: ", url)
    with open(fname, 'wb') as file, tqdm(
        desc=fname,
        total=total,
        unit='iB',
        unit_scale=True,
        unit_divisor=1024,
    ) as bar:
        print("DL ing")
        for data in resp.iter_content(chunk_size=1024):
            size = file.write(data)
            bar.update(size)

def get_snapshot_slot(rpc_address: str):
    url = f'{rpc_address}/snapshot.tar.bz2'
    print(f"requesting: {url}")
    try:
        r = do_request(url_=url, method_='head')
        data = dump.dump_all(r)
        print(data.decode('utf-8')) 
        if 'location' in str(r.headers) and 'error' not in str(r.text):
            snap_location = r.headers["location"]
            print(f"{snap_location}")
            print(r)
            download(url, fname=f".{snap_location}")
            # filtering uncompressed archives
            # if snap_location.endswith('tar') is True:
            #     return None
            # snap_slot_ = int(snap_location.split("-")[1])
            # slots_diff = current_slot - snap_slot_
            # if slots_diff <= MAX_SNAPSHOT_AGE_IN_SLOTS:
            #     # print(f'{rpc_address=} | {slots_diff=}')
            #     json_data["rpc_nodes"].append({
            #         "snapshot_address": url,
            #         "slots_diff": slots_diff,
            #         "latency": r.elapsed.total_seconds() * 1000,
            #         "snapshot_name": r.headers["location"]
            #     })
            #     return None

    except Exception as getSnapErr:
        # print(f'error in get_snapshot_slot(): {getSnapErr}')
        print("ERROR")
        return None

def main():
    rpc_address = "https://psytrbhymqlkfrhudd.dev.genesysgo.net:8899/"

    rpc_nodes = list(set(get_all_rpc_ips(rpc_address)))

    print(rpc_nodes)
    rpc_node = rpc_nodes[0]
    # rpc_address = "127.0.0.1:8899"
    # rpc_address = "api.devnet.solana.com"
    # url = f'http://{rpc_address}/snapshot.tar.bz2'
    get_snapshot_slot(rpc_address=f"http://{rpc_node}")
    # download(snap_location, fname=snap_location)



if __name__ == "__main__":
    main()