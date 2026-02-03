import os
import shutil
import sys
import json

def create_service(service_name):
    # Paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    template_dir = os.path.join(base_dir, 'services', 'template')
    new_service_dir = os.path.join(base_dir, 'services', service_name)

    # 1. Validation
    if os.path.exists(new_service_dir):
        print(f"Error: Service '{service_name}' already exists.")
        return

    print(f"Creating new service: {service_name}...")

    # 2. Copy Template
    try:
        shutil.copytree(template_dir, new_service_dir)
        print(f" - Copied template files to {new_service_dir}")
    except Exception as e:
        print(f"Error copying files: {e}")
        return

    # 3. Update package.json
    package_json_path = os.path.join(new_service_dir, 'package.json')
    try:
        with open(package_json_path, 'r') as f:
            data = json.load(f)
        
        data['name'] = f"{service_name}-service"
        data['description'] = f"Microservice for {service_name}"
        
        with open(package_json_path, 'w') as f:
            json.dump(data, f, indent=2)
        print(f" - Updated package.json")
    except Exception as e:
        print(f"Error updating package.json: {e}")

    # 4. Instructions for Docker Compose
    print("\nSUCCESS! Service created.")
    print("\n[NEXT STEP] Add the following to 'docker/docker-compose.yml':")
    
    docker_snippet = f"""
  {service_name}_ms:
    build: ../services/{service_name}
    container_name: {service_name}_ms
    environment:
      - PORT=3000
      - DB_HOST={service_name}_db
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_NAME={service_name}_db
      - SERVICE_NAME={service_name}-service
    ports:
      - "300X:3000" # CHANGE 300X to a unique port
      - "92XX:9229" # CHANGE 92XX to a unique debug port
    depends_on:
      - {service_name}_db
    volumes:
      - ../services/{service_name}:/app
      - /app/node_modules
    networks:
      - app_network

  {service_name}_db:
    image: postgres:13
    container_name: {service_name}_db
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB={service_name}_db
    ports:
      - "54XX:5432" # CHANGE 54XX to a unique port
    volumes:
      - {service_name}_db_data:/var/lib/postgresql/data
    networks:
      - app_network
    """
    
    print(docker_snippet)
    print(f"\nDon't forget to add a volume: {service_name}_db_data:")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python create_ms.py <service_name>")
    else:
        create_service(sys.argv[1])
