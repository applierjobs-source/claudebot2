"""
Entrypoint: run agent loop. Config loaded from CONFIG_B64 in agent.py.
MVP: single continuous run.
"""
from agent import run_loop

if __name__ == "__main__":
    run_loop()
